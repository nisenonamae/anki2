/* Anki2 同期 — notion-daily の roadmap/apps/anki2/sync/ に、小分けのファイルで置く。
   変わったファイルだけをやり取りする。ノート・カードなどは1件ずつ見比べて新しいほうを残し、消した印も伝える。復習の記録は足し合わせるだけ */
"use strict";
window.APP_VER_SYNC = "r4.2";
const SYNC = { busy: false, err: "", last: A2.S.meta.lastSync || 0, timer: null, note: "" };
const conn = () => A2.S.meta.conn || null;
const ghBase = c => "https://api.github.com/repos/" + encodeURIComponent(c.owner) + "/" + encodeURIComponent(c.repo) + "/contents/";
const ghPath = (c, p) => (c.base || "roadmap/apps/anki2").replace(/\/+$/, "") + "/" + p;
const ghHdr = (c, raw) => ({ Authorization: "Bearer " + c.token, Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json" });
const enc = p => p.split("/").map(encodeURIComponent).join("/");
async function ghList(c, dir){ const r = await fetch(ghBase(c) + enc(ghPath(c, dir)) + "?ref=" + encodeURIComponent(c.branch || "main") + "&t=" + Date.now(), { headers: ghHdr(c), cache: "no-store" });
  if (r.status === 404) return []; if (!r.ok) throw new Error("一覧を読めない(" + r.status + ")"); const j = await r.json(); return Array.isArray(j) ? j : []; }
async function ghGet(c, p){ const r = await fetch(ghBase(c) + enc(ghPath(c, p)) + "?ref=" + encodeURIComponent(c.branch || "main") + "&t=" + Date.now(), { headers: ghHdr(c, true), cache: "no-store" }); if (r.status === 404) return null; if (!r.ok) throw new Error("読めない(" + r.status + ")"); return r; }
const b64 = buf => { const u = new Uint8Array(buf); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
async function ghPut(c, p, bytes, sha, msg){ const r = await fetch(ghBase(c) + enc(ghPath(c, p)), { method: "PUT", headers: Object.assign({ "Content-Type": "application/json" }, ghHdr(c)), body: JSON.stringify({ message: msg || "Anki2 同期", content: b64(bytes), branch: c.branch || "main", sha: sha || undefined }) });
  if (r.status === 409 || r.status === 422) return { conflict: true }; if (!r.ok) throw new Error("送れない(" + r.status + ")"); const j = await r.json(); return { sha: j.content && j.content.sha }; }
/* ファイルの中身:{ v:1, recs:[…], del:{ id: 消した時刻 } } */
const STORE_OF = p => p.startsWith("notes/") ? "notes" : p.startsWith("cards/") ? "cards" : p.startsWith("revlog/") ? "revlog" : p;
function localFile(p){ const st = STORE_OF(p), recs = []; for (const x of A2.S[st].values()) if (A2.pathOf(st, x) === p) recs.push(x);
  const del = {}; Object.entries(((A2.S.meta.tombs || {})[st]) || {}).forEach(([id, t]) => { if (t.p === p) del[id] = t.mod; });
  recs.sort((a, b) => a.id < b.id ? -1 : 1); return { v: 1, recs: recs.map(r => { if (st === "media") return r; const o = Object.assign({}, r); return o; }), del }; }
async function mergeIn(p, remote){ const st = STORE_OF(p), put = [], gone = [], tombs = A2.S.meta.tombs || {};
  (remote.recs || []).forEach(r => { const l = A2.S[st].get(r.id), t = (tombs[st] || {})[r.id]; if (t && t.mod >= (r.mod || 0)) return; if (!l || (r.mod || 0) > (l.mod || 0)) put.push(r); });
  Object.entries(remote.del || {}).forEach(([id, mod]) => { const l = A2.S[st].get(id); if (l && (l.mod || 0) <= mod) gone.push(id); tombs[st] = tombs[st] || {}; if (!tombs[st][id] || tombs[st][id].mod < mod) tombs[st][id] = { mod, p }; });
  if (put.length) await A2.save(st, put, { keepMod: true, fromSync: true }); if (gone.length) await A2.remove(st, gone, { fromSync: true }); A2.S.meta.tombs = tombs; return put.length + gone.length; }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/* 同期の途中で頼まれたら、捨てずに、終わってからもう一度まわす */
function syncNow(){ if (!conn() || !conn().token) return Promise.resolve(0); if (SYNC.busy) { SYNC.again = true; return SYNC.p; }
  if (A2.VER !== (window.APP_VER_APP || A2.VER)) return Promise.resolve(0);
  const run = async () => { let n = 0; do { SYNC.again = false; n += await syncOnce(); } while (SYNC.again); return n; };
  SYNC.p = (navigator.locks && navigator.locks.request) ? navigator.locks.request("anki2-sync", run) : run(); SYNC.busy = true; return SYNC.p; }   // 同じ端末で2つ開いていても、同期は1つずつ
async function syncOnce(){ const c = conn(); SYNC.busy = true; if (!c) { SYNC.busy = false; return 0; } SYNC.err = ""; SYNC.note = "同期中…"; paintSync(); let changed = 0;
  try { const shas = A2.S.meta.syncSha || {}, remote = {};
    const top = await ghList(c, "sync"); for (const f of top) { if (f.type === "file") remote[f.name.replace(/\.json$/, "")] = f.sha; else if (f.type === "dir") { for (const g of await ghList(c, "sync/" + f.name)) if (g.type === "file") remote[f.name + "/" + g.name.replace(/\.json$/, "")] = g.sha; } }
    const paths = new Set([...A2.dirty, ...Object.keys(remote).filter(p => remote[p] !== shas[p])]); let done = 0;
    for (const p of paths) { SYNC.note = "同期中… " + (++done) + "/" + paths.size; paintSync(); let rsha = remote[p] || null, tries = 0;
      while (tries++ < 4) { let rem = { v: 1, recs: [], del: {} };
        const readRem = async () => { const r = await ghGet(c, "sync/" + p + ".json"); if (!r) return { v: 1, recs: [], del: {} }; const t = await r.text(); let j; try { j = JSON.parse(t); } catch (e) { j = null; }
          if (!j || !Array.isArray(j.recs)) throw new Error("置き場所の「" + p + "」が読めない(壊れているかもしれないので、上書きせずに止めた)"); return j; };
        if (rsha && rsha !== shas[p]) { rem = await readRem(); changed += await mergeIn(p, rem); }
        else if (rsha) rem = await readRem();
        const mine = localFile(p); if (!mine.recs.length && !Object.keys(mine.del).length && !rsha) break;
        if (rsha && same(mine, rem)) { shas[p] = rsha; break; }
        const res = await ghPut(c, "sync/" + p + ".json", new TextEncoder().encode(JSON.stringify(mine)), rsha, "Anki2 同期 " + p);
        if (res.conflict) { const l = await ghList(c, "sync" + (p.includes("/") ? "/" + p.split("/")[0] : "")); const f = l.find(x => x.name === p.split("/").pop() + ".json"); rsha = f ? f.sha : null; shas[p] = null; continue; }
        shas[p] = res.sha; break; }
      A2.dirty.delete(p); }
    /* 画像・音声:まだ送っていないものを送る */
    const up = new Set(A2.S.meta.mediaUp || []); let k = 0; for (const name of [...up]) { SYNC.note = "画像・音声を送っている " + (++k) + "/" + up.size; paintSync(); const m = await A2.getOne("media", name); if (!m) { up.delete(name); continue; }
      const res = await ghPut(c, "media/" + name, new Uint8Array(await m.blob.arrayBuffer()), null, "Anki2 画像 " + name); if (res.conflict || res.sha) up.delete(name); await A2.setMeta("mediaUp", [...up]); }
    /* 古い「消した印」は90日で片づける */
    const tombs = A2.S.meta.tombs || {}, old = Date.now() - 90 * 86400e3; Object.values(tombs).forEach(t => Object.keys(t).forEach(id => { if (t[id].mod < old) delete t[id]; }));
    if (changed) { const probs = await A2.check(true); if (probs.length) console.warn("点検で直した:", probs); }
    await A2.setMeta("tombs", tombs); await A2.setMeta("syncSha", shas); await A2.setMeta("dirty", [...A2.dirty]); SYNC.last = Date.now(); await A2.setMeta("lastSync", SYNC.last); SYNC.note = "";
  } catch (e) { SYNC.err = e.message || String(e); SYNC.note = ""; console.error(e); }
  SYNC.busy = false; paintSync(); if (A2.dirty.size && !SYNC.err) SYNC.again = SYNC.again || false; if (changed && !V.rv && !(typeof EXV !== "undefined" && EXV.run) && !V.sheet) render(); if (A2.dirty.size && !SYNC.err) schedule(); return changed; }
A2.fetchMedia = async name => { const c = conn(); if (!c || !c.token) return null; try { const r = await ghGet(c, "media/" + name); return r ? await r.blob() : null; } catch (e) { return null; } };
function schedule(){ if (!conn()) return; clearTimeout(SYNC.timer); SYNC.timer = setTimeout(() => syncNow(), 15000); }
A2.onDirty = () => { paintSync(); schedule(); };
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && A2.dirty.size) syncNow(); if (document.visibilityState === "visible") syncNow(); });
window.addEventListener("online", () => syncNow());
/* 上の見出しに、同期のようす */
function syncBadge(){ const c = conn(); if (!c) return `<button class="hdbtn" data-more="sync">同期なし</button>`; const n = A2.dirty.size + (A2.S.meta.mediaUp || []).length;
  return `<button class="hdbtn sync${SYNC.err ? " err" : n ? " wait" : ""}" data-more="sync" id="syncb">${SYNC.busy ? "同期中" : SYNC.err ? "同期できない" : n ? "未送信 " + n : "同期済み"}</button>`; }
function paintSync(){ const b = $("syncb"); if (b) b.outerHTML = syncBadge(); const s = $("syncst"); if (s) s.innerHTML = syncStatus(); }
function syncStatus(){ const c = conn(); return c ? `${SYNC.busy ? SYNC.note : SYNC.err ? '<b style="color:var(--shu)">同期できなかった:' + esc(SYNC.err) + "</b>" : "最後の同期:" + (SYNC.last ? new Date(SYNC.last).toLocaleString("ja-JP") : "まだ")}・未送信 ${A2.dirty.size}${(A2.S.meta.mediaUp || []).length ? "・送っていない画像と音声 " + A2.S.meta.mediaUp.length : ""}` : "つないでいない"; }
function syncSheet(){ const c = conn() || { owner: "nisenonamae", repo: "notion-daily", branch: "main", base: "roadmap/apps/anki2", token: "" }; const f = (id, l, v, ph, type) => `<div class="f"><label>${l}</label><input id="${id}" type="${type || "text"}" value="${esc(v || "")}" placeholder="${esc(ph || "")}" style="width:100%;padding:.4rem .5rem;border:1px solid var(--rule);border-radius:3px" autocomplete="off"></div>`;
  return `<h3>同期</h3><p class="note" style="margin-top:0">notion-daily に置いて、スマホ・Chromebook・Mac で同じデータを使う。ほかのアプリと同じトークンでよい(端末ごとに1回入れる)。</p><div class="note" id="syncst">${syncStatus()}</div>
    ${f("sy-o", "持ち主(GitHubの名前)", c.owner)}${f("sy-r", "リポジトリ", c.repo)}${f("sy-b", "ブランチ", c.branch)}${f("sy-p", "置き場所", c.base)}${f("sy-t", "トークン", c.token, "github_pat_… / ghp_…", "password")}
    <div class="row"><button class="btn" data-syncsave>${conn() ? "保存して同期" : "つないで同期"}</button>${conn() ? '<button class="btn ghost sm" data-syncnow>今すぐ同期</button><button class="linkx" data-syncoff style="color:var(--shu);margin-left:auto">つなぐのをやめる</button>' : ""}</div>
    <p class="note">はじめてつなぐ端末は、置き場所のデータとこの端末のデータを合わせる。カードが多いと、最初の1回は数分かかる。</p>`; }
document.addEventListener("click", async e => { const b = e.target.closest("button"); if (!b) return;
  if (b.hasAttribute("data-syncsave")) { const c = { owner: $("sy-o").value.trim(), repo: $("sy-r").value.trim(), branch: $("sy-b").value.trim() || "main", base: $("sy-p").value.trim() || "roadmap/apps/anki2", token: $("sy-t").value.trim() }; if (!c.owner || !c.repo || !c.token) { toast("持ち主・リポジトリ・トークンを入れてください"); render(); return; }
    const first = !conn(); await A2.setMeta("conn", c); if (first) { /* はじめて:この端末のデータを全部「送る」にする */ const ps = new Set(); ["notes", "cards", "revlog", "notetypes", "decks", "subjects", "exsub"].forEach(st => { for (const x of A2.S[st].values()) ps.add(A2.pathOf(st, x)); }); A2.markDirty([...ps]); const ms = await A2.all("media"); await A2.setMeta("mediaUp", ms.map(m => m.name)); }
    toast("つないだ。同期する"); render(); syncNow(); return; }
  if (b.hasAttribute("data-syncnow")) { syncNow(); return; }
  if (b.hasAttribute("data-syncoff")) { if (!confirm("この端末の同期をやめる?(データはこの端末に残る)")) return; await A2.setMeta("conn", null); render(); return; } });
window.syncNow = syncNow; window.syncBadge = syncBadge; window.syncSheet = syncSheet;
setTimeout(() => { if (conn()) syncNow(); }, 1500);
