/* Anki2 同期(r4.3)— notion-daily の roadmap/apps/anki2/ に置く。
   ・ふだんは「変わった記録だけ」を書いた小さなファイル(sync/changes/端末/時刻.json)を1つ送る
   ・何個ファイルを送っても、GitHub への記録(コミット)は1回にまとめる(Git の仕組みを直接使う)
   ・まず「前から何か変わったか」を1回だけ聞き、変わっていなければ終わり
   ・変わった分のファイルがたまったら、どれかの端末が全体のファイル(sync/notes/… など)にまとめ直し、古いものを片づける
   ・記録は1件ずつ見比べて、新しいほうを残す。消した印も伝える。復習の記録は足すだけ */
"use strict";
window.APP_VER_SYNC = "r4.7";
const SYNC = { busy: false, err: "", last: 0, timer: null, note: "", again: false, p: null };
const STORES_SYNC = ["notes", "cards", "revlog", "notetypes", "decks", "subjects", "exsub"];
const conn = () => A2.S.meta.conn || null;
const devId = () => A2.S.meta.deviceId || (A2.S.meta.deviceId = "d" + A2.uid());
const gh = (c, path, opt) => fetch("https://api.github.com/repos/" + encodeURIComponent(c.owner) + "/" + encodeURIComponent(c.repo) + path, Object.assign({ cache: "no-store" }, opt || {}, { headers: Object.assign({ Authorization: "Bearer " + c.token, Accept: "application/vnd.github+json" }, (opt && opt.body) ? { "Content-Type": "application/json" } : {}) }));
const ghJ = async (c, path, opt, okMissing) => { const r = await gh(c, path, opt); if (okMissing && (r.status === 404 || r.status === 409)) return null; if (!r.ok) { const e = new Error("GitHub が " + r.status + " を返した"); e.status = r.status; throw e; } return r.json(); };
const base = c => (c.base || "roadmap/apps/anki2").replace(/\/+$/, "");
const enc = p => p.split("/").map(encodeURIComponent).join("/");
const u8b64 = u => { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const b64u8 = b => { const s = atob(String(b).replace(/\s/g, "")), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
/* Git と同じ計算で、中身から名前(sha)を出す:同じ中身ならわざわざ送らない */
async function gitSha(text){ const body = new TextEncoder().encode(text), head = new TextEncoder().encode("blob " + body.length + "\0"), all = new Uint8Array(head.length + body.length); all.set(head); all.set(body, head.length);
  return [...new Uint8Array(await crypto.subtle.digest("SHA-1", all))].map(b => b.toString(16).padStart(2, "0")).join(""); }
/* 置き場所の今のようす:いちばん新しい記録(コミット)と、sync の下の全部のファイルの名前(sha) */
async function remoteHead(c){ const ref = await ghJ(c, "/git/ref/heads/" + enc(c.branch || "main")); return ref.object.sha; }
async function remoteState(c, head){ head = head || await remoteHead(c);
  const dir = await ghJ(c, "/contents/" + enc(base(c)) + "?ref=" + encodeURIComponent(head), null, true); const files = {};
  const syncDir = Array.isArray(dir) ? dir.find(x => x.name === "sync" && x.type === "dir") : null;
  if (syncDir) { const t = await ghJ(c, "/git/trees/" + syncDir.sha + "?recursive=1"); (t.tree || []).forEach(x => { if (x.type === "blob") files[x.path] = x.sha; }); }
  const commit = await ghJ(c, "/git/commits/" + head); return { head, tree: commit.tree.sha, files }; }
async function readBlob(c, sha){ const j = await ghJ(c, "/git/blobs/" + sha); const t = new TextDecoder().decode(b64u8(j.content)); let o; try { o = JSON.parse(t); } catch (e) { o = null; }
  if (!o || typeof o !== "object") throw new Error("置き場所のファイルが読めない(壊れているかもしれないので、上書きせずに止めた)"); return o; }
/* 受け取った記録を合わせる(新しいほうを残す・消した印を守る) */
async function applyRecs(recsBy, delBy){ let n = 0; const tombs = A2.S.meta.tombs || {};
  for (const st of STORES_SYNC) { const put = [], gone = [];
    ((recsBy || {})[st] || []).forEach(r => { const l = A2.S[st].get(r.id), t = (tombs[st] || {})[r.id]; if (t && t.mod >= (r.mod || 0)) return; if (!l || (r.mod || 0) > (l.mod || 0)) put.push(r); });
    Object.entries(((delBy || {})[st]) || {}).forEach(([id, mod]) => { const l = A2.S[st].get(id); if (l && (l.mod || 0) <= mod) gone.push(id); tombs[st] = tombs[st] || {}; if (!tombs[st][id] || tombs[st][id].mod < mod) { let pth = null; try { pth = A2.pathOf(st, l || { id, t: 0 }); } catch (e) {} if (st === "revlog" && !l) pth = (tombs[st][id] || {}).p || null; tombs[st][id] = { mod, p: pth }; } });
    if (put.length) await A2.save(st, put, { keepMod: true, fromSync: true }); if (gone.length) await A2.remove(st, gone, { fromSync: true }); n += put.length + gone.length; }
  A2.S.meta.tombs = tombs; return n; }
/* 全体のファイル(まとめ直したもの):今までと同じ並べ方(notes/123.json など) */
function shardFiles(){ const files = {}; for (const st of STORES_SYNC) { for (const x of A2.S[st].values()) { const p = A2.pathOf(st, x); (files[p] = files[p] || { v: 1, st, recs: [], del: {} }).recs.push(x); }
    Object.entries(((A2.S.meta.tombs || {})[st]) || {}).forEach(([id, t]) => { const p = t.p || null; if (p && files[p]) files[p].del[id] = t.mod; }); }
  Object.values(files).forEach(f => { f.recs.sort((a, b) => a.id < b.id ? -1 : 1); delete f.st; }); return files; }
const storeOfShard = p => p.startsWith("notes/") ? "notes" : p.startsWith("cards/") ? "cards" : p.startsWith("revlog/") ? "revlog" : p;
/* まとめて送る:たくさんのファイルを、1回の記録(コミット)に */
async function commitFiles(c, rs, entries, msg){ let tree = rs.tree; const CH = 2.5e6; let chunk = [], size = 0;
  const flush = async () => { if (!chunk.length) return; const t = await ghJ(c, "/git/trees", { method: "POST", body: JSON.stringify({ base_tree: tree, tree: chunk }) }); tree = t.sha; chunk = []; size = 0; };
  for (const e of entries) { chunk.push(e); size += (e.content || "").length + 200; if (size > CH) await flush(); } await flush();
  const cm = await ghJ(c, "/git/commits", { method: "POST", body: JSON.stringify({ message: msg, tree, parents: [rs.head] }) });
  const r = await gh(c, "/git/refs/heads/" + enc(c.branch || "main"), { method: "PATCH", body: JSON.stringify({ sha: cm.sha, force: false }) });
  if (r.status === 422 || r.status === 409) return null;   // そのあいだに、ほかの端末やアプリが書いた → 読み直してやり直す
  if (!r.ok) throw new Error("GitHub が " + r.status + " を返した"); return cm.sha; }
function syncNow(){ if (!conn() || !conn().token) return Promise.resolve(0); if (SYNC.busy) { SYNC.again = true; return SYNC.p; }
  const run = async () => { let n = 0; do { SYNC.again = false; n += await syncOnce(); } while (SYNC.again && !SYNC.err); return n; };
  SYNC.busy = true; SYNC.p = (navigator.locks && navigator.locks.request) ? navigator.locks.request("anki2-sync", run) : run(); return SYNC.p; }
async function syncOnce(){ const c = conn(); SYNC.busy = true; SYNC.err = ""; if (!c) { SYNC.busy = false; return 0; } let changed = 0;
  try { const M = A2.S.meta; M.baseSha = M.baseSha || {}; M.applied = M.applied || {};
    /* 前の版(r4・r4.1・r4.2)から:ファイルごとの「送る」を、記録ごとに直す */
    if (A2.dirty && A2.dirty.size) { for (const st of STORES_SYNC) { const ids = []; for (const x of A2.S[st].values()) if (A2.dirty.has(A2.pathOf(st, x))) ids.push(x.id); if (ids.length) A2.markPending(st, ids); } A2.dirty.clear(); await A2.setMeta("dirty", []); if (M.syncSha) { M.baseSha = Object.assign({}, M.syncSha); delete M.syncSha; } }
    for (let attempt = 0; attempt < 5; attempt++) {
      SYNC.note = "置き場所を確かめている"; paintSync(); const head = await remoteHead(c);
      if (head === M.lastHead && !A2.pendingCount() && !(M.mediaUp || []).length) break;   // どこも変わっていない(問い合わせは1回だけ)
      const rs = await remoteState(c, head);
      /* 1. 受け取る:まとめ直したファイルのうち変わったもの、まだ読んでいない変更のファイル */
      if (rs.head !== M.lastHead) { const shards = Object.keys(rs.files).filter(p => !p.startsWith("changes/") && rs.files[p] !== M.baseSha[p.replace(/\.json$/, "")]);
        let k = 0; for (let i = 0; i < shards.length; i += 6) { const part = shards.slice(i, i + 6), got = await Promise.all(part.map(p => readBlob(c, rs.files[p])));
          for (let j = 0; j < part.length; j++) { const p = part[j], o = got[j], key = p.replace(/\.json$/, ""), st = storeOfShard(key); changed += await applyRecs({ [st]: o.recs || [] }, { [st]: o.del || {} }); M.baseSha[key] = rs.files[p]; }
          k += part.length; SYNC.note = "受け取っている " + k + "/" + shards.length; paintSync(); }
        Object.keys(M.baseSha).forEach(k2 => { if (!rs.files[k2 + ".json"]) delete M.baseSha[k2]; });
        const chs = Object.keys(rs.files).filter(p => p.startsWith("changes/") && !M.applied[p]).sort((a, b) => (a.split("/").pop() < b.split("/").pop() ? -1 : 1));
        k = 0; for (let i = 0; i < chs.length; i += 6) { const part = chs.slice(i, i + 6), got = await Promise.all(part.map(p => readBlob(c, rs.files[p]))); for (let j = 0; j < part.length; j++) { changed += await applyRecs(got[j].recs, got[j].del); M.applied[part[j]] = 1; } k += part.length; SYNC.note = "受け取っている(変更)" + k + "/" + chs.length; paintSync(); }
        Object.keys(M.applied).forEach(p => { if (!rs.files[p]) delete M.applied[p]; }); }
      /* 2. 送る */
      const pend = {}; let pn = 0; for (const st of STORES_SYNC) { const ids = [...(A2.pending[st] || [])]; if (ids.length) { pend[st] = ids; pn += ids.length; } }
      const media = (M.mediaUp || []).slice(0, 40), changeFiles = Object.keys(rs.files).filter(p => p.startsWith("changes/")), hasBase = Object.keys(rs.files).some(p => !p.startsWith("changes/"));
      const oldest = changeFiles.reduce((a, p) => Math.min(a, +(p.split("/").pop().replace(/\D/g, "")) || Date.now()), Date.now());
      const compact = !hasBase && (pn > 0 || A2.S.cards.size) || pn > 3000 || changeFiles.length > (window.A2_COMPACT_AT || 150) || (changeFiles.length > 20 && Date.now() - oldest > 14 * 86400e3);
      if (!pn && !media.length && !compact) { M.lastHead = rs.head; break; }
      const entries = []; const B = base(c) + "/sync/", newBase = {};
      if (compact) { SYNC.note = "まとめ直している"; paintSync(); const files = shardFiles();
        for (const [p, f] of Object.entries(files)) { const text = JSON.stringify(f), sha = await gitSha(text); newBase[p] = sha; if (rs.files[p + ".json"] !== sha) entries.push({ path: B + p + ".json", mode: "100644", type: "blob", content: text }); }
        Object.keys(rs.files).forEach(p => { const key = p.replace(/\.json$/, ""); if (p.startsWith("changes/") || (!files[key] && !p.startsWith("changes/"))) entries.push({ path: B + p, mode: "100644", type: "blob", sha: null }); }); }
      else if (pn) { const recs = {}, del = {}, tombs = M.tombs || {}; Object.entries(pend).forEach(([st, ids]) => { ids.forEach(id => { const x = A2.S[st].get(id); if (x) (recs[st] = recs[st] || []).push(x); else if ((tombs[st] || {})[id]) (del[st] = del[st] || {})[id] = tombs[st][id].mod; }); });
        entries.push({ path: B + "changes/" + devId() + "/" + Date.now() + ".json", mode: "100644", type: "blob", content: JSON.stringify({ v: 1, dev: devId(), recs, del }) }); }
      for (const name of media) { const m = await A2.getOne("media", name); if (!m) continue; SYNC.note = "画像・音声を送っている"; paintSync(); const bl = await ghJ(c, "/git/blobs", { method: "POST", body: JSON.stringify({ content: u8b64(new Uint8Array(await m.blob.arrayBuffer())), encoding: "base64" }) }); entries.push({ path: base(c) + "/media/" + name, mode: "100644", type: "blob", sha: bl.sha }); }
      if (!entries.length) { M.lastHead = rs.head; Object.entries(pend).forEach(([st, ids]) => ids.forEach(id => A2.pending[st].delete(id))); break; }
      SYNC.note = "送っている"; paintSync(); const sha = await commitFiles(c, rs, entries, "Anki2 同期" + (compact ? "(まとめ直し)" : "") + " " + devId());
      if (!sha) { SYNC.note = "ほかの端末と重なったので、読み直す"; paintSync(); continue; }
      /* 送れた:送った分だけ「送っていない」から外す(送っているあいだの新しい変更は残る) */
      Object.entries(pend).forEach(([st, ids]) => ids.forEach(id => A2.pending[st].delete(id)));
      M.mediaUp = (M.mediaUp || []).filter(n => !media.includes(n));
      if (compact) { M.baseSha = newBase; M.applied = {}; } else entries.filter(e => e.path.includes("/changes/")).forEach(e => { M.applied[e.path.slice(B.length)] = 1; });
      M.lastHead = sha; break; }
    await A2.put("meta", [{ k: "pending", v: Object.fromEntries(Object.entries(A2.pending).map(([k, v]) => [k, [...v]])) }]);
    const tombs = A2.S.meta.tombs || {}, old = Date.now() - 90 * 86400e3; Object.values(tombs).forEach(t => Object.keys(t).forEach(id => { if (t[id].mod < old) delete t[id]; }));
    for (const k of ["tombs", "baseSha", "applied", "lastHead", "mediaUp", "deviceId"]) await A2.setMeta(k, A2.S.meta[k]);
    if (changed) { const probs = await A2.check(true); if (probs.length) console.warn("点検で直した:", probs); }
    SYNC.last = Date.now(); await A2.setMeta("lastSync", SYNC.last); SYNC.note = "";
  } catch (e) { SYNC.err = e.status === 401 ? "トークンが違うか、期限が切れている" : e.status === 403 ? "GitHub に止められた(しばらく待つと戻る。トークンの権限も確かめる)" : (e.message || String(e)); SYNC.note = ""; console.error(e); }
  SYNC.busy = false; paintSync(); if (changed && !V.rv && !(typeof EXV !== "undefined" && EXV.run) && !V.sheet) render(); if (A2.pendingCount() && !SYNC.err) schedule(); return changed; }
A2.fetchMedia = async name => { const c = conn(); if (!c || !c.token) return null; try { const r = await gh(c, "/contents/" + enc(base(c) + "/media/" + name) + "?ref=" + encodeURIComponent(c.branch || "main"), { headers: {} }); if (!r.ok) return null;
    const r2 = await fetch("https://api.github.com/repos/" + encodeURIComponent(c.owner) + "/" + encodeURIComponent(c.repo) + "/contents/" + enc(base(c) + "/media/" + name) + "?ref=" + encodeURIComponent(c.branch || "main"), { headers: { Authorization: "Bearer " + c.token, Accept: "application/vnd.github.raw+json" }, cache: "no-store" }); return r2.ok ? await r2.blob() : null; } catch (e) { return null; } };
function schedule(){ if (!conn()) return; clearTimeout(SYNC.timer); SYNC.timer = setTimeout(() => syncNow(), 15000); }
A2.onDirty = () => { paintSync(); schedule(); };
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && A2.pendingCount()) syncNow(); if (document.visibilityState === "visible") syncNow(); });
window.addEventListener("online", () => syncNow());
function syncBadge(){ const c = conn(); if (!c) return `<button class="hdbtn" data-more="sync">同期なし</button>`; const n = A2.pendingCount() + (A2.S.meta.mediaUp || []).length;
  return `<button class="hdbtn sync${SYNC.err ? " err" : n ? " wait" : ""}" data-more="sync" id="syncb">${SYNC.busy ? "同期中" : SYNC.err ? "同期できない" : n ? "未送信 " + n : "同期済み"}</button>`; }
function paintSync(){ const b = $("syncb"); if (b) b.outerHTML = syncBadge(); const s = $("syncst"); if (s) s.innerHTML = syncStatus(); }
function syncStatus(){ const c = conn(), last = SYNC.last || A2.S.meta.lastSync; return c ? `${SYNC.busy ? esc(SYNC.note || "同期中") : SYNC.err ? '<b style="color:var(--shu)">同期できなかった:' + esc(SYNC.err) + "</b>" : "最後の同期:" + (last ? new Date(last).toLocaleString("ja-JP") : "まだ")}・未送信 ${A2.pendingCount()}${(A2.S.meta.mediaUp || []).length ? "・送っていない画像と音声 " + A2.S.meta.mediaUp.length : ""}` : "つないでいない"; }
function syncSheet(){ const c = conn() || { owner: "nisenonamae", repo: "notion-daily", branch: "main", base: "roadmap/apps/anki2", token: "" }; const f = (id, l, v, ph, type) => `<div class="f"><label>${l}</label><input id="${id}" type="${type || "text"}" value="${esc(v || "")}" placeholder="${esc(ph || "")}" style="width:100%;padding:.4rem .5rem;border:1px solid var(--rule);border-radius:3px" autocomplete="off"></div>`;
  return `<h3>同期</h3><p class="note" style="margin-top:0">notion-daily に置いて、スマホ・Chromebook・Mac で同じデータを使う。ほかのアプリと同じトークンでよい(端末ごとに1回入れる)。</p><div class="note" id="syncst">${syncStatus()}</div>
    ${f("sy-o", "持ち主(GitHubの名前)", c.owner)}${f("sy-r", "リポジトリ", c.repo)}${f("sy-b", "ブランチ", c.branch)}${f("sy-p", "置き場所", c.base)}${f("sy-t", "トークン", c.token, "github_pat_… / ghp_…", "password")}
    <div class="row"><button class="btn" data-syncsave>${conn() ? "保存して同期" : "つないで同期"}</button>${conn() ? '<button class="btn ghost sm" data-syncnow>今すぐ同期</button><button class="linkx" data-syncoff style="color:var(--shu);margin-left:auto">つなぐのをやめる</button>' : ""}</div>
    <p class="note">ふだんは変わった分だけを送るので、カードが多くても軽い。はじめての端末だけは、全体を受け取るのに少し時間がかかる。</p>`; }
document.addEventListener("click", async e => { const b = e.target.closest("button"); if (!b) return;
  if (b.hasAttribute("data-syncsave")) { const c = { owner: $("sy-o").value.trim(), repo: $("sy-r").value.trim(), branch: $("sy-b").value.trim() || "main", base: $("sy-p").value.trim() || "roadmap/apps/anki2", token: $("sy-t").value.trim() }; if (!c.owner || !c.repo || !c.token) { toast("持ち主・リポジトリ・トークンを入れてください"); render(); return; }
    const first = !conn(); await A2.setMeta("conn", c); if (first) { for (const st of STORES_SYNC) A2.markPending(st, [...A2.S[st].keys()]); const ms = await A2.all("media"); await A2.setMeta("mediaUp", ms.map(m => m.name)); }
    toast("つないだ。同期する"); render(); syncNow(); return; }
  if (b.hasAttribute("data-syncnow")) { syncNow(); return; }
  if (b.hasAttribute("data-syncoff")) { if (!confirm("この端末の同期をやめる?(データはこの端末に残る)")) return; await A2.setMeta("conn", null); render(); return; } });
window.syncNow = syncNow; window.syncBadge = syncBadge; window.syncSheet = syncSheet; window.SYNC = SYNC;
setTimeout(() => { if (conn()) syncNow(); }, 1500);
