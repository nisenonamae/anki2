/* Anki2 core — 保存(IndexedDB)・Ankiの書き出しの読み込み・カードの描き方・FSRS
   ここは画面を持たない。app.js から使う。 */
"use strict";
const A2 = {};
/* ───── 日付(1日の切り替わりは午前4時) ───── */
A2.ROLL = 4;
A2.dayOf = ms => { const d = new Date(ms - A2.ROLL * 3600e3); return Math.floor((d.getTime() - d.getTimezoneOffset() * 60e3) / 86400e3); };
A2.today = () => A2.dayOf(Date.now());
A2.dayStr = day => { const d = new Date(day * 86400e3); return (d.getUTCMonth() + 1) + "/" + d.getUTCDate(); };
A2.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ───── 保存(IndexedDB)。起動時に全部を読み、変えたものだけ書く ───── */
const STORES = ["notes", "cards", "revlog", "notetypes", "decks", "media", "meta", "subjects"];
A2.db = null;
A2.open = () => new Promise((res, rej) => { const r = indexedDB.open("anki2", 1);
  r.onupgradeneeded = () => { const db = r.result; STORES.forEach(n => { if (!db.objectStoreNames.contains(n)) db.createObjectStore(n, { keyPath: n === "media" ? "name" : n === "meta" ? "k" : "id" }); }); };
  r.onsuccess = () => { A2.db = r.result; res(A2.db); }; r.onerror = () => rej(r.error); });
A2.all = store => new Promise((res, rej) => { const q = A2.db.transaction(store).objectStore(store).getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => rej(q.error); });
A2.put = (store, items) => new Promise((res, rej) => { if (!items.length) return res(); const tx = A2.db.transaction(store, "readwrite"), os = tx.objectStore(store); items.forEach(x => os.put(x)); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
A2.del = (store, keys) => new Promise((res, rej) => { if (!keys.length) return res(); const tx = A2.db.transaction(store, "readwrite"), os = tx.objectStore(store); keys.forEach(k => os.delete(k)); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
A2.getOne = (store, key) => new Promise((res, rej) => { const q = A2.db.transaction(store).objectStore(store).get(key); q.onsuccess = () => res(q.result || null); q.onerror = () => rej(q.error); });
/* 記憶の中の写し(画面はこれを読む) */
A2.S = { notes: new Map(), cards: new Map(), revlog: new Map(), notetypes: new Map(), decks: new Map(), subjects: new Map(), meta: {} };
A2.loadAll = async () => { for (const n of ["notes", "cards", "revlog", "notetypes", "decks", "subjects"]) { A2.S[n] = new Map((await A2.all(n)).map(x => [x.id, x])); }
  (await A2.all("meta")).forEach(m => { A2.S.meta[m.k] = m.v; });
  try { if (navigator.storage && navigator.storage.persist) A2.S.meta.persisted = await navigator.storage.persist(); } catch (e) {} };
A2.save = async (store, items) => { items = [].concat(items); items.forEach(x => A2.S[store].set(x.id, x)); await A2.put(store, items); };
A2.remove = async (store, ids) => { ids = [].concat(ids); ids.forEach(id => A2.S[store].delete(id)); await A2.del(store, ids); };
A2.setMeta = async (k, v) => { A2.S.meta[k] = v; await A2.put("meta", [{ k, v }]); };
/* 画像・音声:名前 → ファイル。描くときは blob の URL にする */
const mediaURL = new Map();
A2.mediaUrl = async name => { if (mediaURL.has(name)) return mediaURL.get(name); const m = await A2.getOne("media", name); const u = m ? URL.createObjectURL(m.blob) : ""; mediaURL.set(name, u); return u; };

/* ───── Ankiの書き出し(.apkg / .colpkg)を読む ───── */
/* protobuf を少しだけ読む(ノートタイプ・テンプレートの設定、メディアの一覧) */
function pb(buf){ let i = 0; const out = {}; const vi = () => { let s = 0, r = 0, b; do { b = buf[i++]; r += (b & 0x7f) * Math.pow(2, s); s += 7; } while (b >= 0x80); return r; };
  while (i < buf.length) { const key = vi(), f = Math.floor(key / 8), w = key % 8; let v; if (w === 0) v = vi(); else if (w === 2) { const n = vi(); v = buf.subarray(i, i + n); i += n; } else if (w === 1) { v = buf.subarray(i, i + 8); i += 8; } else if (w === 5) { v = buf.subarray(i, i + 4); i += 4; } else break; (out[f] = out[f] || []).push(v); } return out; }
const utf8 = b => new TextDecoder().decode(b);
let SQL = null;
A2.sql = async () => { if (SQL) return SQL; SQL = await initSqlJs({ locateFile: f => "https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/" + f }); return SQL; };
A2.readPackage = async (file, onStep) => { const step = t => onStep && onStep(t);
  step("ファイルを開いている"); const zip = fflate.unzipSync(new Uint8Array(await file.arrayBuffer()));
  const unz = b => (b[0] === 0x28 && b[1] === 0xb5 && b[2] === 0x2f && b[3] === 0xfd) ? fzstd.decompress(b) : b;   // zstd ならほどく
  const colName = zip["collection.anki21b"] ? "collection.anki21b" : zip["collection.anki21"] ? "collection.anki21" : "collection.anki2";
  if (!zip[colName]) throw new Error("Ankiの書き出しではないようです(中にデータベースがない)");
  step("データベースを読んでいる"); const S = await A2.sql(); const db = new S.Database(unz(zip[colName]));
  const q = (sql, p) => { const st = db.prepare(sql); if (p) st.bind(p); const rows = []; while (st.step()) rows.push(st.getAsObject()); st.free(); return rows; };
  const has = t => q("select name from sqlite_master where type='table' and name=?", [t]).length > 0;
  /* Ankiの決まりでは、名前の並べ替えに専用の規則を使う。ここでは名前を読むだけなので、その規則をふつうの比べ方で置き換える */
  try { db.create_function("unicase", (a, b) => 0); } catch (e) {}
  const col = q("select crt from col")[0] || { crt: Math.floor(Date.now() / 1000) };
  const out = { crt: col.crt, notetypes: [], decks: [], notes: [], cards: [], revlog: [], media: [], legacy: colName === "collection.anki2" };
  step("ノートタイプとデッキ");
  if (has("notetypes")) {
    q("select id, name, config from notetypes").forEach(nt => { const c = pb(nt.config || new Uint8Array()); const fields = q("select name from fields where ntid=? order by ord", [nt.id]).map(r => r.name);
      const tmpls = q("select name, config from templates where ntid=? order by ord", [nt.id]).map(t => { const tc = pb(t.config || new Uint8Array()); return { name: t.name, q: tc[1] ? utf8(tc[1][0]) : "", a: tc[2] ? utf8(tc[2][0]) : "" }; });
      out.notetypes.push({ id: "nt" + nt.id, name: nt.name, fields, tmpls, css: c[3] ? utf8(c[3][0]) : "", cloze: (c[1] && c[1][0]) === 1, use: "暗記" }); });
    try { db.exec("PRAGMA writable_schema=1"); } catch (e) {}
    q("select id, name from decks").forEach(d => out.decks.push({ id: "d" + d.id, name: String(d.name).split("\x1f").join("::") }));
  } else {
    const c = q("select models, decks from col")[0]; const models = JSON.parse(c.models || "{}"), decks = JSON.parse(c.decks || "{}");
    Object.values(models).forEach(m => out.notetypes.push({ id: "nt" + m.id, name: m.name, fields: m.flds.sort((a, b) => a.ord - b.ord).map(f => f.name), tmpls: m.tmpls.sort((a, b) => a.ord - b.ord).map(t => ({ name: t.name, q: t.qfmt, a: t.afmt })), css: m.css || "", cloze: m.type === 1, use: "暗記" }));
    Object.values(decks).forEach(d => out.decks.push({ id: "d" + d.id, name: d.name }));
  }
  step("ノート"); q("select id, guid, mid, mod, tags, flds from notes").forEach(n => { const nt = out.notetypes.find(x => x.id === "nt" + n.mid); const vals = String(n.flds).split("\x1f"), f = {}; (nt ? nt.fields : vals.map((_, i) => "欄" + (i + 1))).forEach((k, i) => f[k] = vals[i] || "");
    out.notes.push({ id: "n" + n.id, guid: n.guid, nt: "nt" + n.mid, f, tags: String(n.tags || "").trim().split(/\s+/).filter(Boolean), mod: n.mod * 1000 }); });
  step("カード"); const crtDay = A2.dayOf(col.crt * 1000);
  q("select id, nid, did, odid, ord, mod, type, queue, due, odue, ivl, factor, reps, lapses, left, flags, data from cards").forEach(c => { let data = {}; try { data = JSON.parse(c.data || "{}"); } catch (e) {}
    const did = c.odid ? c.odid : c.did, due = c.odid ? c.odue : c.due;
    const st = c.type === 0 ? "新規" : c.type === 1 ? "学習中" : c.type === 3 ? "再学習" : "復習";
    const card = { id: "c" + c.id, nid: "n" + c.nid, deck: "d" + did, ord: c.ord, st, ivl: c.ivl, reps: c.reps, lapses: c.lapses, flag: c.flags & 7, susp: c.queue === -1, bury: c.queue === -2 || c.queue === -3, buryDay: (c.queue === -2 || c.queue === -3) ? A2.today() : null, mod: c.mod * 1000, s: data.s || null, d: data.d || null, step: 0 };
    if (c.type === 0) card.pos = due; else if (c.queue === 1) card.dueMs = due * 1000; else card.dueDay = crtDay + due;   // 復習の期日は「作った日からの日数」で入っている
    if (c.type === 1 || c.type === 3) { if (c.queue === 3) card.dueDay = crtDay + due; card.left = c.left % 1000; }
    out.cards.push(card); });
  step("復習の記録"); q("select id, cid, ease, ivl, lastIvl, time, type from revlog").forEach(r => out.revlog.push({ id: "r" + r.id, cid: "c" + r.cid, t: r.id, g: r.ease, ivl: r.ivl, last: r.lastIvl, ms: r.time, kind: r.type }));
  db.close();
  step("画像・音声"); const mf = zip["media"]; if (mf && mf.length) { const raw = unz(mf); let map = {};
    if (raw[0] === 0x7b) map = JSON.parse(utf8(raw));   // 古い形:{"0":"a.jpg"}
    else { const top = pb(raw); (top[1] || []).forEach((e, i) => { const m = pb(e); if (m[1]) map[String(i)] = utf8(m[1][0]); }); }
    Object.entries(map).forEach(([k, name]) => { if (zip[k]) out.media.push({ name, blob: new Blob([unz(zip[k])]) }); }); }
  return out; };
/* 読み込んだものを足す。同じ番号のものは1つにまとめ、新しいほうを残す。復習の記録は足すだけ */
A2.mergePackage = async (pkg, onStep) => { const step = t => onStep && onStep(t), S = A2.S, res = { notes: 0, newNotes: 0, cards: 0, revlog: 0, media: 0, notetypes: 0, decks: 0 };
  step("保存している");
  const nts = pkg.notetypes.map(nt => { const old = S.notetypes.get(nt.id); return old ? Object.assign({}, nt, { use: old.use, auto: old.auto, dupKeys: old.dupKeys }) : nt; });
  await A2.save("notetypes", nts); res.notetypes = nts.length;
  const decks = pkg.decks.filter(d => d.name !== "Default" || pkg.cards.some(c => c.deck === d.id)).map(d => { const old = S.decks.get(d.id); return Object.assign({ opt: A2.defaultOpt() }, old || {}, { id: d.id, name: old ? old.name : d.name }); });   // Anki2 で場所を変えたデッキは、そのまま
  await A2.save("decks", decks); res.decks = decks.length;
  /* 分野:いちばん上のデッキの名前 */
  const subs = [...new Set(decks.map(d => d.name.split("::")[0]))].filter(n => ![...S.subjects.values()].some(s => s.name === n)).map((n, i) => ({ id: "s" + A2.uid() + i, name: n, cat: "study", c: ["#2F4F8A", "#B5432F", "#3D7A55", "#7B4F9A", "#9A6A1E", "#1F7A8C"][(S.subjects.size + i) % 6] }));
  await A2.save("subjects", subs);
  const notes = pkg.notes.filter(n => { const old = S.notes.get(n.id); if (!old) res.newNotes++; return !old || (n.mod || 0) > (old.mod || 0); }); await A2.save("notes", notes); res.notes = notes.length;
  const cards = pkg.cards.filter(c => { const old = S.cards.get(c.id); return !old || (c.mod || 0) > (old.mod || 0); }); await A2.save("cards", cards); res.cards = cards.length;
  const rl = pkg.revlog.filter(r => !S.revlog.has(r.id)); await A2.save("revlog", rl); res.revlog = rl.length;
  /* FSRSの覚え具合がない(古いAnkiや、FSRSを使っていなかった)カードは、記録から計算し直す */
  const byCard = new Map(); [...S.revlog.values()].forEach(r => { if (!byCard.has(r.cid)) byCard.set(r.cid, []); byCard.get(r.cid).push(r); });
  const fixed = []; cards.forEach(c => { if (c.st === "新規" || (c.s && c.d)) return; const m = A2.replay(byCard.get(c.id) || []); if (m) { c.s = m.s; c.d = m.d; c.lastDay = m.lastDay; fixed.push(c); } });
  cards.forEach(c => { if (c.st !== "新規" && !c.lastDay) { const rs = byCard.get(c.id); if (rs && rs.length) c.lastDay = A2.dayOf(Math.max(...rs.map(r => r.t))); else if (c.dueDay != null) c.lastDay = c.dueDay - (c.ivl || 0); } });
  await A2.save("cards", cards); res.replayed = fixed.length;
  if (pkg.media.length) { await A2.put("media", pkg.media); pkg.media.forEach(m => mediaURL.delete(m.name)); res.media = pkg.media.length; }
  return res; };

/* ───── FSRS-5(本家の初期のパラメータ)と、本家と同じ学習ステップ ───── */
A2.W = [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621];
const W5 = A2.W, DECAY = -0.5, FACTOR = 19 / 81;
A2.R = (t, S) => Math.pow(1 + FACTOR * t / S, DECAY);
A2.I = (S, r) => S / FACTOR * (Math.pow(r, 1 / DECAY) - 1);
const clampD = x => Math.min(10, Math.max(1, x)), fD0 = G => clampD(W5[4] - Math.exp(W5[5] * (G - 1)) + 1), fS0 = G => W5[G - 1];
const fDn = (D, G) => clampD(W5[7] * fD0(4) + (1 - W5[7]) * (D + (-W5[6] * (G - 3)) * (10 - D) / 9));
const fSr = (D, S, r, G) => S * (Math.exp(W5[8]) * (11 - D) * Math.pow(S, -W5[9]) * (Math.exp(W5[10] * (1 - r)) - 1) * (G === 2 ? W5[15] : 1) * (G === 4 ? W5[16] : 1) + 1);
const fSf = (D, S, r) => Math.min(S, W5[11] * Math.pow(D, -W5[12]) * (Math.pow(S + 1, W5[13]) - 1) * Math.exp(W5[14] * (1 - r)));
const fSs = (S, G) => S * Math.exp(W5[17] * (G - 3 + W5[18]));
/* 復習の記録から、覚え具合を計算し直す(同じ日のうちは短期の式) */
A2.replay = revs => { let S = null, D = null, last = null; revs.filter(r => r.g >= 1 && r.g <= 4 && r.kind !== 4).sort((a, b) => a.t - b.t).forEach(r => { const day = A2.dayOf(r.t);
    if (S == null) { S = fS0(r.g); D = fD0(r.g); } else if (day === last) { S = fSs(S, r.g); D = fDn(D, r.g); } else { const t = day - last, R = A2.R(t, S); S = r.g === 1 ? fSf(D, S, R) : fSr(D, S, R, r.g); D = fDn(D, r.g); }
    last = day; }); return S == null ? null : { s: S, d: D, lastDay: last }; };
A2.defaultOpt = () => ({ newDay: 20, revDay: 200, steps: "1m 10m", relearn: "10m", retention: 90, maxIvl: 36500, leech: 8, burySib: true });
const parseSteps = str => (String(str || "").match(/\d+(\.\d+)?\s*[smhd]?/g) || []).map(x => { const v = parseFloat(x); return /d/.test(x) ? v * 1440 : /h/.test(x) ? v * 60 : /s/.test(x) ? v / 60 : v; });   // 分
A2.optOf = c => Object.assign(A2.defaultOpt(), (A2.S.decks.get(c.deck) || {}).opt || {});
/* 判定したときの行き先。wait は分(1日 = 1440分)で返す */
A2.schedule = (c, G, now) => { now = now || Date.now(); const o = A2.optOf(c), ret = (+o.retention || 90) / 100, maxI = +o.maxIvl || 36500, gIvl = S => Math.min(maxI, Math.max(1, Math.round(A2.I(S, ret)))), today = A2.dayOf(now);
  const steps = parseSteps(o.steps).length ? parseSteps(o.steps) : [1, 10], relearn = parseSteps(o.relearn).length ? parseSteps(o.relearn) : [10];
  const out = { s: c.s, d: c.d, st: c.st, step: c.step || 0 };
  if (c.st === "新規" || !c.s) { out.s = fS0(G); out.d = fD0(G); }
  else if (c.st === "学習中" || c.st === "再学習") { out.s = fSs(c.s, G); out.d = fDn(c.d || 5, G); }
  else { const t = Math.max(0, today - (c.lastDay != null ? c.lastDay : today - (c.ivl || 0))), r = A2.R(t, Math.max(.1, c.s)); out.d = fDn(c.d || 5, G); out.s = G === 1 ? fSf(c.d || 5, c.s, r) : fSr(c.d || 5, c.s, r, G); }
  if (c.st === "新規" || c.st === "学習中" || c.st === "再学習") { const st = c.st === "再学習" ? relearn : steps, i = c.st === "新規" ? 0 : Math.min(c.step || 0, st.length - 1);
    if (G === 1) { out.st = c.st === "再学習" ? "再学習" : "学習中"; out.step = 0; out.wait = st[0]; }
    else if (G === 2) { out.st = c.st === "再学習" ? "再学習" : "学習中"; out.step = i; out.wait = i === 0 ? (st.length > 1 ? (st[0] + st[1]) / 2 : Math.min(st[0] * 1.5, st[0] + 1440)) : st[i]; }
    else if (G === 3 && i + 1 < st.length) { out.st = c.st === "再学習" ? "再学習" : "学習中"; out.step = i + 1; out.wait = st[i + 1]; }
    else { out.st = "復習"; out.ivl = gIvl(out.s); out.wait = out.ivl * 1440; }
  } else if (G === 1) { out.st = "再学習"; out.step = 0; out.wait = relearn[0]; out.lapse = true; }
  else { out.st = "復習"; out.ivl = gIvl(out.s); out.wait = out.ivl * 1440; }
  return out; };
A2.nextWaits = c => { const a = [1, 2, 3, 4].map(G => A2.schedule(c, G));
  if (c.st === "復習") { const iv = a.map(x => x.ivl || 0); iv[1] = Math.max(1, iv[1]); iv[2] = Math.max(iv[2], iv[1] + 1); iv[3] = Math.max(iv[3], iv[2] + 1); [1, 2, 3].forEach(k => { a[k].ivl = iv[k]; a[k].wait = iv[k] * 1440; }); }   // 難しい ≦ 正解 < 簡単
  return a; };
A2.fmtWait = m => m < 60 ? Math.round(m) + "分" : m < 1440 ? Math.round(m / 60) + "時間" : m < 43200 ? Math.round(m / 1440) + "日" : m < 525600 ? (Math.round(m / 43200 * 10) / 10) + "か月" : (Math.round(m / 525600 * 10) / 10) + "年";

/* ───── 今日の分 ───── */
A2.isDue = (c, now) => { now = now || Date.now(); if (c.susp || (c.bury && c.buryDay === A2.dayOf(now))) return false; if (c.st === "新規") return false;
  if (c.dueMs != null && (c.st === "学習中" || c.st === "再学習")) return c.dueMs <= now + 20 * 60e3;   // 本家と同じく、20分先までは先に出す
  return c.dueDay != null && c.dueDay <= A2.dayOf(now); };
A2.deckIds = prefix => [...A2.S.decks.values()].filter(d => d.name === prefix || d.name.startsWith(prefix + "::")).map(d => d.id);
A2.counts = prefix => { const ids = new Set(A2.deckIds(prefix)), now = Date.now(), today = A2.dayOf(now); let n = 0, l = 0, r = 0; const newDone = A2.newDoneToday();
  const top = [...A2.S.decks.values()].find(d => d.name === prefix), opt = A2.optOf({ deck: top ? top.id : [...ids][0] }); for (const c of A2.S.cards.values()) { if (!ids.has(c.deck) || c.susp || (c.bury && c.buryDay === today)) continue;
    if (c.st === "新規") n++; else if (A2.isDue(c, now)) { if (c.st === "復習") r++; else l++; } }
  return { n: Math.max(0, Math.min(n, (+opt.newDay || 0) - (newDone[prefix] || 0))), l, r: Math.min(r, +opt.revDay || 9999) }; };
/* 今日はじめて出した新しいカードの数(復習の記録から数える) */
A2.newDoneToday = () => { const t = A2.today(), first = new Map(); for (const r of A2.S.revlog.values()) { const f = first.get(r.cid); if (!f || r.t < f) first.set(r.cid, r.t); }
  const o = {}; for (const [cid, t0] of first) { if (A2.dayOf(t0) !== t) continue; const c = A2.S.cards.get(cid); if (!c) continue; const d = A2.S.decks.get(c.deck); if (!d) continue; const p = d.name.split("::"); p.forEach((_, i) => { const k = p.slice(0, i + 1).join("::"); o[k] = (o[k] || 0) + 1; }); } return o; };
A2.queue = (prefix, filter) => { const ids = new Set(A2.deckIds(prefix)), now = Date.now(), cs = [...A2.S.cards.values()].filter(c => filter ? filter(c) : ids.has(c.deck));
  const k = A2.counts(prefix), learn = cs.filter(c => (c.st === "学習中" || c.st === "再学習") && A2.isDue(c, now)).sort((a, b) => (a.dueMs || 0) - (b.dueMs || 0));
  const rev = cs.filter(c => c.st === "復習" && A2.isDue(c, now)).sort((a, b) => a.dueDay - b.dueDay).slice(0, filter ? 9999 : k.r);
  const nw = cs.filter(c => c.st === "新規" && !c.susp && !(c.bury && c.buryDay === A2.today())).sort((a, b) => (a.pos || 0) - (b.pos || 0)).slice(0, filter ? 9999 : k.n);
  return learn.concat(rev, nw); };

/* ───── カードを描く(Ankiと同じ決まり) ───── */
A2.emptyField = v => /^(?:\s|<\/?(?:br|div)\s?\/?>)*$/i.test(String(v == null ? "" : v));
A2.renderTmpl = (tmpl, note, nt, ord, back, front) => {
  const F = note.f, sec = str => { const re = /\{\{([#^])([^}]+)\}\}([\s\S]*?)\{\{\/\2\}\}/; let m; while ((m = re.exec(str))) { const key = m[2].trim(); let has = !A2.emptyField(F[key]); if (key === "Tags") has = note.tags.length > 0; const keep = m[1] === "#" ? has : !has; str = str.slice(0, m.index) + (keep ? sec(m[3]) : "") + str.slice(m.index + m[0].length); } return str; };
  let s = sec(tmpl).replace(/\{\{FrontSide\}\}/g, front || "");
  return s.replace(/\{\{([^}#/^]+)\}\}/g, (all, key) => { key = key.trim(); const parts = key.split(":"), name = parts.pop(), filters = parts;
    if (name === "Tags") return note.tags.join(" "); if (name === "Deck") return ""; if (name === "Card") return (nt.tmpls[Math.min(ord, nt.tmpls.length - 1)] || {}).name || ""; if (name === "Type") return nt.name;
    let v = F[name] != null ? String(F[name]) : "";
    if (filters.includes("cloze")) { const c = ord + 1; v = v.replace(/\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g, (m, k, ans, hint) => +k === c ? (back ? `<span class="cloze">${ans}</span>` : `<span class="cloze">[${hint || "..."}]</span>`) : ans); }
    if (filters.includes("text")) v = v.replace(/<[^>]*>/g, "");
    if (filters.includes("hint")) v = A2.emptyField(v) ? "" : `<a class="hint" href="#" onclick="this.style.display='none';this.nextElementSibling.style.display='inline';return false;">${name}</a><span class="hint" style="display:none">${v}</span>`;
    if (filters.includes("type")) v = back ? `<div class="typed-ans">${v}</div>` : `<input class="typeans" id="typeans" autocomplete="off">`;
    if (filters.some(f => /^tts/.test(f))) v = `<span class="tts" data-tts="${v.replace(/<[^>]*>/g, "").replace(/"/g, "")}">🔊</span>`;
    return v; });
};
A2.cardHtml = (card, back, fOver) => { const n0 = A2.S.notes.get(card.nid); if (!n0) return ""; const note = fOver ? Object.assign({}, n0, { f: fOver }) : n0, nt = A2.S.notetypes.get(note.nt); if (!nt) return "";
  const tm = nt.tmpls[nt.cloze ? 0 : card.ord] || nt.tmpls[0], fr = A2.renderTmpl(tm.q, note, nt, card.ord, false);
  return back ? A2.renderTmpl(tm.a, note, nt, card.ord, true, fr) : fr; };
/* 音声 [sound:x.mp3] は再生ボタンに */
A2.soundTags = html => String(html).replace(/\[sound:([^\]]+)\]/g, (m, f) => `<button class="a2-snd" data-snd="${f.replace(/"/g, "")}" type="button">▶</button>`);
/* カードを作る(ノートから):テンプレートの表が空なら作らない。穴埋めは c1, c2… ごと */
A2.clozeNums = text => [...new Set([...String(text).matchAll(/\{\{c(\d+)::/g)].map(m => +m[1]))].sort((a, b) => a - b);
A2.genOrds = (note, nt) => { if (nt.use === "演習") return []; if (nt.cloze) { const field = (/\{\{cloze:([^}]+)\}\}/.exec(nt.tmpls[0].q) || [])[1]; return A2.clozeNums(note.f[field ? field.trim() : nt.fields[0]] || "").map(c => c - 1); }
  return nt.tmpls.map((t, i) => i).filter(i => String(A2.renderTmpl(nt.tmpls[i].q, note, nt, i, false)).replace(/<[^>]*>/g, "").trim() || /<(img|svg|audio|video|iframe)/i.test(A2.renderTmpl(nt.tmpls[i].q, note, nt, i, false))); };
/* 重複:ノートタイプの「重複を見る欄」がぜんぶ同じ */
A2.dupKeys = nt => (nt.dupKeys && nt.dupKeys.length ? nt.dupKeys : [nt.fields[0]]);
A2.norm = v => String(v || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
A2.isDup = (nt, f, skip) => { for (const n of A2.S.notes.values()) if (n.nt === nt.id && n.id !== skip && A2.dupKeys(nt).every(k => A2.norm(n.f[k]) === A2.norm(f[k]))) return true; return false; };
window.A2 = A2;
