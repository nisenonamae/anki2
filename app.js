/* Anki2 r1 — 画面。データは core.js の A2.S にある */
"use strict";
const APP_VERSION = "r4.19"; window.APP_VER_APP = APP_VERSION;
const $ = id => document.getElementById(id), esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const CATS = [ { id: "study", name: "学習系" }, { id: "regime", name: "体制系" }, { id: "culture", name: "教養系" } ];
const FL = ["", "#D9534F", "#F0AD4E", "#5CB85C", "#5BC0DE", "#E87DB4", "#8FD3E8", "#9B7BD4"];
const mmss = sec => Math.floor(sec / 60) + ":" + String(Math.floor(sec % 60)).padStart(2, "0");
let V = { mode: "anki", cat: "study", sheet: null, rv: null, bq: "", bsort: "due", bsel: {}, dopen: {}, toast: "", top: false, se: true };
const go = patch => { Object.assign(V, patch); V.top = true; render(); };
const toast = t => { V.toast = t; };
/* 効果音 */
let ac = null; const actx = () => { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === "suspended") ac.resume(); return ac; };
function tone(f, t, d, type, g){ try { const c = actx(), o = c.createOscillator(), a = c.createGain(); o.type = type || "sine"; o.frequency.value = f; a.gain.setValueAtTime(.0001, c.currentTime + t); a.gain.exponentialRampToValueAtTime(g || .18, c.currentTime + t + .01); a.gain.exponentialRampToValueAtTime(.0001, c.currentTime + t + d); o.connect(a); a.connect(c.destination); o.start(c.currentTime + t); o.stop(c.currentTime + t + d + .05); } catch (e) {} }
const SE = { flip: () => tone(520, 0, .09, "triangle", .12), g1: () => { tone(330, 0, .16, "sine", .2); tone(247, .09, .2, "sine", .18); }, g2: () => tone(440, 0, .14, "triangle", .16), g3: () => { tone(660, 0, .1, "triangle", .16); tone(880, .06, .14, "triangle", .14); }, g4: () => { tone(784, 0, .1); tone(1047, .07, .12); tone(1319, .14, .18); },
  undo: () => { tone(700, 0, .08); tone(500, .07, .12); }, done: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * .09, i === 3 ? .5 : .16, "triangle", .18)), tick: () => tone(1200, 0, .04, "square", .05), add: () => { tone(880, 0, .08); tone(1175, .06, .12); } };
const se = k => { if (A2.S.meta.se === false) return; (SE[k] || (() => {}))(); };

/* ───── 分野・デッキ ───── */
const subjOf = name => [...A2.S.subjects.values()].find(s => s.name === name.split("::")[0]);
const catTabs = () => `<div class="ctabs">${CATS.map(c => `<button data-cat="${c.id}" aria-pressed="${V.cat === c.id}">${c.name}</button>`).join("")}</div>`;
const cntHtml = k => k.n + k.l + k.r === 0 ? '<span class="donemk">✓ 済</span>' : `<span class="num"><span class="n">${k.n}</span>・<span class="d">${k.l}</span>・<span style="color:var(--ok);font-weight:700">${k.r}</span></span>`;
function deckRows(sub){ const names = new Set(); [...A2.S.decks.values()].filter(d => d.name.split("::")[0] === sub.name).forEach(d => { const p = d.name.split("::").slice(1); p.forEach((_, i) => names.add(p.slice(0, i + 1).join("::"))); });
  const list = [...names].sort((a, b) => a.localeCompare(b, "ja")).filter(nm => { const p = nm.split("::"); for (let i = 1; i < p.length; i++) if (V.dopen[sub.name + "::" + p.slice(0, i).join("::")] === false) return false; return true; });
  return list.map(nm => { const full = sub.name + "::" + nm, lv = nm.split("::").length - 1, kid = [...names].some(x => x.startsWith(nm + "::")), k = A2.counts(full), leaf = [...A2.S.decks.values()].find(d => d.name === full);
    return `<div class="deck${k.n + k.l + k.r === 0 ? " isdone" : ""}" style="--lv:${lv}">${kid ? `<button class="tg" data-dtog="${esc(full)}">${V.dopen[full] === false ? "▸" : "▾"}</button>` : '<span style="width:1.2rem"></span>'}<div class="nm"><b>${esc(nm.split("::").pop())}</b>${deckToday(full)}</div>${cntHtml(k)}<button class="btn sm" data-study="${esc(full)}">復習</button>${leaf ? `<button class="gear" data-dopt="${leaf.id}" aria-label="オプション">⚙</button>` : '<span style="width:2rem"></span>'}</div>`; }).join(""); }
/* 今日の学習:表示回数(答えた回数。もう一度で何度出してもその分)・終えたカード(次の期日が明日以降になったもの)・新規(今日はじめて)・時間(1回1分で打ち切り) */
let todayCache = null;
function todayIdx(){ const today = A2.today(), key = today + ":" + A2.S.revlog.size + ":" + (A2._rlTick || 0) + ":" + A2.S.cards.size; if (todayCache && todayCache.key === key) return todayCache;
  const first = new Map(), revs = []; for (const r of A2.S.revlog.values()) { if (r.kind === 4) continue; const f = first.get(r.cid); if (f == null || r.t < f) first.set(r.cid, r.t); if (A2.dayOf(r.t) === today) revs.push(r); }
  return todayCache = { key, today, first, revs, memo: {} }; }
function todayOf(prefix){ const T = todayIdx(); if (T.memo[prefix]) return T.memo[prefix]; const ids = prefix ? new Set(A2.deckIds(prefix)) : null, cards = new Set(); let n = 0, ms = 0, again = 0; const kinds = { 新規: 0, 学習: 0, 復習: 0, 再学習: 0 };
  T.revs.forEach(r => { const c = A2.S.cards.get(r.cid); if (ids && (!c || !ids.has(c.deck))) return; n++; ms += Math.min(r.ms || 0, 60000); if (r.g === 1) again++; cards.add(r.cid); const f = T.first.get(r.cid); if (r.kind === 0 && f === r.t) kinds.新規++; else if (r.kind === 0) kinds.学習++; else if (r.kind === 2) kinds.再学習++; else kinds.復習++; });
  let done = 0, nw = 0; cards.forEach(id => { const c = A2.S.cards.get(id); if (c && (c.susp || (c.st === "復習" && c.dueDay > T.today) || (c.dueMs != null && A2.dayOf(c.dueMs) > T.today))) done++; if (A2.dayOf(T.first.get(id)) === T.today) nw++; });
  return T.memo[prefix] = { n, cards: cards.size, done, nw, ms, again, kinds }; }
const minTxt = ms => ms < 60000 ? Math.round(ms / 1000) + "秒" : Math.round(ms / 60000) + "分";
function exToday(){ const today = A2.today(); let n = 0, sec = 0; for (const d of A2.S.exsub.values()) (d.hist || []).forEach(h => { if (A2.dayOf(h.t) === today) { n++; sec += h.sec || 0; } }); return { n, sec }; }
function todayBar(){ const t = todayOf(""), ex = exToday();
  if (!t.n && !ex.n) return `<button class="todaybar" data-todayopen>今日はまだ学習していない</button>`;
  return `<button class="todaybar" data-todayopen>今日 <b>${t.n}</b>回・終えた<b>${t.done}</b>枚・新規<b>${t.nw}</b>・<b>${minTxt(t.ms)}</b>${t.n ? `<small>(1回${Math.round(t.ms / t.n / 100) / 10}秒)</small>` : ""}${ex.n ? `<small>・演習${ex.n}問${Math.round(ex.sec / 60)}分</small>` : ""} <i>▴</i></button>`; }
function deckToday(prefix){ const t = todayOf(prefix); return t.n ? `<small class="dtoday">今日 ${t.n}回・済 ${t.done}枚・${minTxt(t.ms)}</small>` : ""; }
function todaySheet(){ const t = todayOf(""), ex = exToday(), row = (a, b) => `<div class="pkv"><span class="k">${a}</span><span class="v">${b}</span></div>`;
  const subs = [...A2.S.subjects.values()].map(s => [s, todayOf(s.name)]).filter(([, x]) => x.n).sort((a, b) => b[1].n - a[1].n);
  return `<h3>今日の学習</h3>${row("表示回数", t.n + "回(新規 " + t.kinds.新規 + "・学習 " + t.kinds.学習 + "・復習 " + t.kinds.復習 + "・再学習 " + t.kinds.再学習 + ")")}${row("もう一度", t.again + "回" + (t.n ? "(正答率 " + Math.round((1 - t.again / t.n) * 100) + "%)" : ""))}
    ${row("学習したカード", t.cards + "枚(今日の分を終えた " + t.done + "枚・新しく始めた " + t.nw + "枚)")}${row("時間", minTxt(t.ms) + (t.n ? "(1回 " + Math.round(t.ms / t.n / 100) / 10 + "秒・1枚 " + Math.round(t.ms / Math.max(1, t.cards) / 100) / 10 + "秒)" : ""))}${ex.n ? row("演習", ex.n + "問・" + Math.round(ex.sec / 60) + "分") : ""}
    ${subs.length ? `<h2>分野ごと</h2>${subs.map(([s, x]) => row(esc(s.name), x.n + "回・終えた " + x.done + "枚・新規 " + x.nw + "・" + minTxt(x.ms))).join("")}` : ""}
    <p class="note">表示回数は、1枚を「もう一度」で何度か出したらその分も数える(本家と同じ)。終えたカードは、次の期日が明日以降になったもの。時間は1回1分で打ち切って数える。</p>`; }
/* 1枚にかかる時間の見込み:自分の復習の記録から(デッキ → 分野 → 全部 → 決め打ち の順に探す)。1回1分を超えたら1分で打ち切る(本家と同じ) */
let paceCache = null;
function paceOf(prefix){ const today = A2.today();
  if (!paceCache || paceCache.n !== A2.S.revlog.size || paceCache.day !== today) { const byCard = new Map(); for (const r of A2.S.revlog.values()) { if (today - A2.dayOf(r.t) > 60) continue; (byCard.get(r.cid) || byCard.set(r.cid, []).get(r.cid)).push(r); } paceCache = { n: A2.S.revlog.size, day: today, byCard, memo: {} }; }
  if (paceCache.memo[prefix]) return paceCache.memo[prefix];
  const calc = pre => { const ids = pre ? new Set(A2.deckIds(pre)) : null; let rs = 0, rn = 0, ns = 0, nn = 0;
    for (const [cid, list] of paceCache.byCard) { const c = A2.S.cards.get(cid); if (!c || (ids && !ids.has(c.deck))) continue;
      list.forEach(r => { if (r.kind === 1) { rs += Math.min(r.ms || 0, 60000); rn++; } });
      const learn = list.filter(r => r.kind === 0); if (learn.length) { const d0 = A2.dayOf(Math.min(...learn.map(r => r.t))); ns += learn.filter(r => A2.dayOf(r.t) === d0).reduce((a, r) => a + Math.min(r.ms || 0, 60000), 0); nn++; } }
    return { rev: rn >= 5 ? rs / rn / 1000 : null, nw: nn >= 3 ? ns / nn / 1000 : null }; };
  const chain = [prefix, prefix ? prefix.split("::")[0] : null, ""].filter((x, i, a) => x != null && a.indexOf(x) === i); let rev = null, nw = null, src = "決め打ち";
  for (const p of chain) { const k = calc(p); if (rev == null && k.rev != null) { rev = k.rev; src = p ? "「" + p.split("::").pop() + "」の記録" : "全部の記録"; } if (nw == null && k.nw != null) nw = k.nw; if (rev != null && nw != null) break; }
  return paceCache.memo[prefix] = { rev: rev != null ? rev : 8, nw: nw != null ? nw : 20, src }; }
const estMin = (prefix, k) => { const p = paceOf(prefix); return (k.r * p.rev + k.l * p.rev + k.n * p.nw) / 60; };
function ankiHome(){
  const subs = [...A2.S.subjects.values()].filter(s => s.cat === V.cat).sort((a, b) => a.name.localeCompare(b.name, "ja"));
  if (!A2.S.decks.size) return `<div class="empty-big"><b>まだカードがない</b>Ankiの書き出し(.apkg・.colpkg)を読み込むと、ここにデッキが並びます。</div><div class="imp"><b>Ankiから読み込む</b><label class="btn shu" style="cursor:pointer">ファイルを選ぶ<input type="file" id="imp-file" accept=".apkg,.colpkg,application/zip" hidden></label><div class="steplog" id="imp-log"></div></div>`;
  let due = 0, nw = 0, mins = 0; subs.forEach(s => { const k = A2.counts(s.name); due += k.l + k.r; nw += k.n; mins += estMin(s.name, k); });
  return catTabs() + `<div class="today"><div class="tb"><div class="k">今日の復習</div><div class="v">${due}<small>枚</small></div></div><div class="tb"><div class="k">新しいカード</div><div class="v">${nw}<small>枚</small></div></div><div class="tb"><div class="k">見込み</div><div class="v">${Math.round(mins)}<small>分</small></div></div></div>
    <div class="row" style="justify-content:space-between;margin:.8rem 0 .3rem"><span class="note"><span style="color:var(--wave)">新規</span>・<span style="color:var(--shu)">学習中</span>・<span style="color:var(--ok)">復習</span></span><span class="row" style="gap:.7rem"><button class="linkx" data-newsub>+ 分野</button><button class="linkx" data-newdeck="">+ デッキ</button><button class="linkx" data-custom>カスタム学習</button></span></div>
    ${subs.map(s => { const k = A2.counts(s.name); return `<div class="sframe${k.n + k.l + k.r === 0 ? " isdone" : ""}" style="--c:${s.c}"><div class="sfh"><div class="nm"><b>${esc(s.name)}</b>${deckToday(s.name)}</div>${cntHtml(k)}<button class="btn sm" data-study="${esc(s.name)}">まとめて復習</button><button class="gear" data-subedit="${s.id}" aria-label="分野">⚙</button></div><div class="dtree">${deckRows(s)}</div>
      <div class="sff"><button class="linkx" data-oldstudy="${esc(s.name)}">今日より前に足した分だけ(赤・緑)</button><button class="linkx" data-newdeck="${s.id}">+ デッキ</button></div></div>`; }).join("") || '<p class="note">この分類には、まだ分野がない。分野の⚙で分類を変えられる。</p>'}`;
}

/* ───── 復習:1回の復習のあいだ、同じページのまま表と裏を差し替える(Ankiと同じ) ───── */
const FRAME_DOC = () => `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style id="a2css"></style>
<style>html,body{margin:0;background:transparent}body{padding:14px 16px 22px}.a2-snd{font-size:1rem;border:1px solid #ccc;border-radius:50%;width:2rem;height:2rem;background:#fff;cursor:pointer;margin:0 .2rem}img{max-width:100%;height:auto}mjx-container[display="true"]{overflow-x:auto;overflow-y:hidden;max-width:100%}</style>
<script>window.MathJax={tex:{inlineMath:[["\\\\(","\\\\)"]],displayMath:[["\\\\[","\\\\]"]]},svg:{fontCache:"global",scale:1.05},startup:{typeset:false}};<\/script>
<script src="https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js" async><\/script>
<script>
window.a2 = { record: function (o) { parent.postMessage({ a2api: "record", arg: o, cid: (window.A2CARD || {}).id }, "*"); }, setTime: function (sec) { parent.postMessage({ a2api: "setTime", arg: +sec, cid: (window.A2CARD || {}).id }, "*"); },
  suggest: function (g) { parent.postMessage({ a2api: "suggest", arg: g, cid: (window.A2CARD || {}).id }, "*"); }, answer: function (g) { parent.postMessage({ a2api: "answer", arg: g, cid: (window.A2CARD || {}).id }, "*"); }, flip: function () { parent.postMessage({ a2api: "flip", cid: (window.A2CARD || {}).id }, "*"); } };
window.a2show = function (html, css, cls) { document.getElementById("a2css").textContent = css; document.body.className = cls; var qa = document.getElementById("qa"); qa.innerHTML = html;
  Array.prototype.slice.call(qa.querySelectorAll("script")).forEach(function (old) { var s = document.createElement("script"); for (var i = 0; i < old.attributes.length; i++) s.setAttribute(old.attributes[i].name, old.attributes[i].value); s.text = old.textContent; old.parentNode.replaceChild(s, old); });
  var mj = function () { if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([qa]).then(fit).catch(function () {}); else setTimeout(mj, 300); }; mj(); fit(); setTimeout(fit, 200); setTimeout(fit, 800); };
function fit(){ parent.postMessage({ a2h: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) }, "*"); }
document.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest(".a2-snd"); if (b && b.dataset.src) { new Audio(b.dataset.src).play(); } });
window.addEventListener("load", fit); new ResizeObserver(fit).observe(document.documentElement);
<\/script></head><body class="card"><div id="qa"></div></body></html>`;
/* カードからの働きかけ(a2.record / setTime / suggest / answer / flip)。今出ているカードからのものだけ受ける */
window.addEventListener("message", e => { const d = e.data; if (!d || !d.a2api || !V.rv || !rvFrameEl || e.source !== rvFrameEl.contentWindow) return; const r = V.rv, c = rvCur(); if (!c || (d.cid && d.cid !== c.id)) return;
  if (d.a2api === "record") { try { const o = Object.assign({}, r.px || {}, d.arg || {}); if (JSON.stringify(o).length <= 4000) r.px = o; } catch (x) {} }
  else if (d.a2api === "setTime") { if (d.arg > 0 && d.arg < 36000) r.pSec = d.arg; }
  else if (d.a2api === "suggest") { r.sug = [1, 2, 3, 4].includes(+d.arg) ? +d.arg : null; if (r.back) { const el = $("rv-ctl"); if (el) el.innerHTML = rvCtl(); } }
  else if (d.a2api === "answer") { if ([1, 2, 3, 4].includes(+d.arg)) { r.back = true; answer(+d.arg); } }
  else if (d.a2api === "flip") { if (!r.back) { r.back = true; se("flip"); render(); } } });
window.addEventListener("message", e => { if (e.data && e.data.a2h) document.querySelectorAll(".rvframe").forEach(f => { if (f.contentWindow === e.source) f.style.height = Math.max(e.data.a2h, 160) + "px"; }); });
/* 画像の名前を、端末の中の画像の URL に。音声は再生ボタンに */
async function withMedia(html){ html = A2.soundTags(html); const names = new Set(); html.replace(/(src|data-snd)="([^"]+)"/g, (m, a, n) => { if (!/^(https?:|data:|blob:)/.test(n)) names.add(n); return m; });
  const map = {}; for (const n of names) map[n] = await A2.mediaUrl(n);
  return html.replace(/src="([^"]+)"/g, (m, n) => map[n] ? `src="${map[n]}"` : m).replace(/data-snd="([^"]+)"/g, (m, n) => map[n] ? `data-snd="${esc(n)}" data-src="${map[n]}"` : m); }
async function showInFrame(frame, card, back, fOver){ if (!frame) return; const note = A2.S.notes.get(card.nid), nt = A2.S.notetypes.get(note.nt), html = await withMedia(A2.cardHtml(card, back, fOver));
  const h = A2.history(card.id), info = { id: card.id, back: !!back, state: card.st, reps: card.reps || 0, lapses: card.lapses || 0, ivl: card.ivl || 0, stability: card.s || null, difficulty: card.d || null, history: h.map(r => ({ t: r.t, grade: r.g, sec: Math.round((r.ms || 0) / 1000), x: r.x || null, src: A2.revSrc(r) })) };
  const go2 = () => { try { frame.contentWindow.A2CARD = info; } catch (e) {} frame.contentWindow.a2show(html, nt.css || "", "card card" + (card.ord + 1)); };
  if (frame.contentWindow && frame.contentWindow.a2show) go2(); else frame.addEventListener("load", go2, { once: true });
  if (back) { const m = /\[sound:([^\]]+)\]/.exec(A2.cardHtml(card, true, fOver).slice(A2.cardHtml(card, false, fOver).length)) || null; if (m && A2.S.meta.autoplay !== false) { const u = await A2.mediaUrl(m[1]); if (u) new Audio(u).play().catch(() => {}); } }
  else { const m = /\[sound:([^\]]+)\]/.exec(A2.cardHtml(card, false, fOver)); if (m && A2.S.meta.autoplay !== false) { const u = await A2.mediaUrl(m[1]); if (u) new Audio(u).play().catch(() => {}); } } }
/* 出す順番(本家の初めの設定と同じ):
   1. 期日になった学習中のカード(もう一度で1分後、など)を先に
   2. 今日の復習と新しいカードを混ぜて(復習は期日の古い順・同じ日はばらばら、新しいカードはデッキの順で、復習のあいだに均等に)
   3. それもなければ、先取りの上限(20分)以内に期日になる学習中のカード
   4. それより先なら、待つ(時間になれば出る)。デッキを出て入り直しても同じ */
const LEARN_AHEAD = () => (+A2.S.meta.learnAhead || 20) * 60e3;
const isLearn = c => c.st === "学習中" || c.st === "再学習";
const buriedNow = c => c.bury && c.buryDay === A2.today();
function rvScope(r, c){ return r.filter ? r.filter(c) : r.ids.has(c.deck); }
function rvLearning(r){ const out = []; for (const c of A2.S.cards.values()) if (isLearn(c) && c.dueMs != null && !c.susp && !buriedNow(c) && rvScope(r, c)) out.push(c); return out.sort((a, b) => a.dueMs - b.dueMs); }
function buildMain(r){ const today = A2.today(), rev = [], nw = []; let k = r.filter ? null : A2.counts(r.prefix);
  for (const c of A2.S.cards.values()) { if (c.susp || buriedNow(c) || !rvScope(r, c)) continue;
    if (c.st === "新規") nw.push(c); else if (c.st === "復習" || (isLearn(c) && c.dueMs == null)) { if (r.filter || (c.dueDay != null && c.dueDay <= today)) rev.push(c); } }
  const rnd = new Map(); rev.forEach(c => rnd.set(c.id, Math.random())); rev.sort((a, b) => (a.dueDay || 0) - (b.dueDay || 0) || rnd.get(a.id) - rnd.get(b.id)); nw.sort((a, b) => (a.pos || 0) - (b.pos || 0));
  const R = k ? rev.slice(0, k.r + k.l) : rev, N = k ? nw.slice(0, k.n) : nw, main = [];
  if (!N.length) R.forEach(c => main.push(c.id)); else if (!R.length) N.forEach(c => main.push(c.id)); else { const step = (R.length + N.length) / N.length; let ni = 0, ri = 0; for (let i = 0; i < R.length + N.length; i++) { if (ni < N.length && (i + 1) >= Math.round((ni + 1) * step)) main.push(N[ni++].id); else if (ri < R.length) main.push(R[ri++].id); else main.push(N[ni++].id); } }
  return main; }
function rvPick(r, force){ const now = Date.now(), L = rvLearning(r);
  if (L.length && L[0].dueMs <= now) return { id: L[0].id, main: false };
  while (r.mi < r.main.length) { const c = A2.S.cards.get(r.main[r.mi]); if (c && !c.susp && !buriedNow(c) && !r.answered.has(c.id) && !(isLearn(c) && c.dueMs != null)) return { id: c.id, main: true }; r.mi++; }
  if (L.length && (force || L[0].dueMs <= now + LEARN_AHEAD())) return { id: L[0].id, main: false };
  if (L.length) return { wait: L[0].dueMs }; return { done: true }; }
function rvEnsure(){ const r = V.rv; if (!r || r.cur) return; r.px = null; r.pSec = null; r.sug = null; const p = rvPick(r, r.force); r.force = false; r.wait = null; if (p.id) { r.cur = p.id; r.curMain = p.main; r.cardT0 = Date.now(); } else if (p.wait) r.wait = p.wait; }
const rvCur = () => V.rv && V.rv.cur ? A2.S.cards.get(V.rv.cur) : null;
function rvCounts(r){ const now = Date.now(), today = A2.today(); let n = 0, rv = 0; for (let i = r.mi; i < r.main.length; i++) { const c = A2.S.cards.get(r.main[i]); if (!c || c.susp || buriedNow(c) || r.answered.has(c.id) || (isLearn(c) && c.dueMs != null)) continue; if (c.st === "新規") n++; else rv++; }
  const L = rvLearning(r), l = L.filter(c => c.dueMs <= now + LEARN_AHEAD()).length, lToday = L.filter(c => A2.dayOf(c.dueMs) === today).length; return { n, l, r: rv, rest: n + rv + lToday }; }
function startStudy(prefix, filter, title){ const r = { title: title || prefix, prefix, filter, ids: new Set(filter ? [] : A2.deckIds(prefix)), mi: 0, cur: null, back: false, t0: Date.now(), cardT0: Date.now(), done: 0, again: 0, hist: [], answered: new Set() };
  r.main = buildMain(r); const p = rvPick(r); if (p.done) { toast("今はここに出すカードがない"); render(); return; }
  try { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); } catch (e) {}
  wakeOn(); go({ rv: r }); }
setInterval(() => { const r = V.rv; if (r && r.wait && Date.now() >= r.wait) { r.wait = null; render(); } else if (r && r.wait) { const el = $("rvwait"); if (el) el.textContent = rvWaitText(r.wait); } }, 2000);
const rvWaitText = t => { const m = Math.max(0, Math.ceil((t - Date.now()) / 60000)), d = new Date(t); return "あと " + m + "分(" + d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0") + ")"; };
let wake = null; async function wakeOn(){ try { wake = await navigator.wakeLock.request("screen"); } catch (e) {} } function wakeOff(){ try { wake && wake.release(); } catch (e) {} wake = null; }
function rvTimeHtml(){ const r = V.rv; if (!r) return ""; const now = Date.now(), el = (now - r.t0) / 1000, k = rvCounts(r), rest = k.rest, avg = r.done ? el / r.done : 0, card = (now - (r.cardT0 || r.t0)) / 1000, slow = r.cur && card > Math.max(10, avg * 1.5);
  const pc = paceOf(r.prefix || ""), guess = k.n * pc.nw + (k.r + (k.rest - k.n - k.r)) * pc.rev, fin = rest ? new Date(now + (r.done >= 3 ? avg * rest : guess) * 1000) : null;
  return `<div class="tb2"><small>経過</small><b>${mmss(el)}</b></div><div class="tb2"><small>1枚の平均</small><b>${avg ? (Math.round(avg * 10) / 10) + "<i>秒</i>" : "—"}</b></div><div class="tb2${slow ? " slow" : ""}"><small>このカード</small><b>${r.cur ? Math.round(card) + "<i>秒</i>" : "—"}</b></div><div class="tb2"><small>終わる時刻</small><b>${fin ? fin.getHours() + ":" + String(fin.getMinutes()).padStart(2, "0") : "—"}</b></div>`; }
setInterval(() => { const el = $("rvtime"); if (el && V.rv) el.innerHTML = rvTimeHtml(); }, 1000);
function rvDone(){ const r = V.rv, sec = Math.round((Date.now() - r.t0) / 1000); return `<div class="result" style="margin-top:1rem"><b>おつかれさま。「${esc(r.title)}」の今の分は終わり</b><div class="note">${r.done}枚・もう一度 ${r.again}・${Math.floor(sec / 60)}分${sec % 60}秒・1枚 ${r.done ? (Math.round(sec / r.done * 10) / 10) : 0}秒</div></div><div class="row"><button class="btn" data-rvend>デッキへ戻る</button>${r.hist.length ? '<button class="btn ghost" data-rvundo>元に戻す</button>' : ""}</div>`; }
function rvTop(){ const r = V.rv, k = rvCounts(r), total = r.done + k.rest, pct = total ? r.done / total * 100 : 0;
  return `<div class="rvstick"><div class="rvtop"><button class="back" data-rvend>‹ やめる</button><b>${esc(r.title.split("::").pop())}</b><span class="cnt">${(() => { const c = rvCur(), kind = !c ? "" : c.st === "新規" ? "n" : (isLearn(c) && c.dueMs != null) ? "l" : "r";   // 今のカードの種類に下線(本家と同じ)
      return `<span class="n${kind === "n" ? " cur" : ""}">${k.n}</span> + <span class="l${kind === "l" ? " cur" : ""}">${k.l}</span> + <span class="r${kind === "r" ? " cur" : ""}">${k.r}</span>`; })()}</span></div>
    <div class="seekrow"><div class="seek"><i style="width:${pct}%"></i><b style="left:${pct}%"></b></div><span class="seekn"><b>${r.done}</b> / ${total}</span></div><div class="rvbig" id="rvtime">${rvTimeHtml()}</div></div>`; }
function rvOv(){ const c = rvCur(); if (!c) return ""; const n = A2.S.notes.get(c.nid); return (c.flag ? `<span class="flagbar" style="background:${FL[c.flag]}"></span>` : "") + (n && n.tags.includes("marked") ? '<span class="markst">★</span>' : ""); }
function rvCtl(){ const r = V.rv, c = rvCur(), ivs = A2.nextWaits(c);
  return `${r.back ? `<div class="ansbar">${["もう一度", "難しい", "正解", "簡単"].map((x, k) => `<button class="ans a${k + 1}${r.sug === k + 1 ? " sug" : ""}" data-grade="${k + 1}"><small>${r.sug === k + 1 ? "おすすめ・" : ""}${A2.fmtWait(ivs[k].wait)}</small>${x}</button>`).join("")}</div><div class="fliprow"><button class="linkx" data-toface>表に戻る</button></div>` : `<button class="btn showans" data-showans>答えを見る</button>`}
    <div class="rvtools2"><button class="tl" data-rvundo${r.hist.length ? "" : " disabled"}><i>↶</i>元に戻す</button><button class="tl" data-rvedit><i>✎</i>直す</button><button class="tl${VOICE.on ? " on" : ""}" data-voice><i>🎤</i>声 ${VOICE.on ? "入" : "切"}</button><button class="tl" data-rvmore><i>⋯</i>その他</button></div>
    ${VOICE.on ? `<div class="vstat"><span class="dot"></span>聞いています:「答え」「表」「もう一度」「難しい」「正解」「簡単」「戻す」「やめる」${VOICE.last ? `<b class="vheard">聞き取った「${esc(VOICE.last)}」</b>` : ""}</div>` : ""}
    <p class="note" style="text-align:center;margin-top:.5rem">キーボード:スペースで答え・B で表に戻る・1〜4で判定・Z で元に戻す・E で直す。リモコン(矢印):→ 答え・正解、← もう一度、↑ 簡単、↓ 難しい</p>`; }
/* 復習の画面の骨組み:#rv-box(カードの枠)は、その回の復習が終わるまで一度も作り直さない・動かさない */
function review(){ const r = V.rv; rvEnsure(); if (r.wait) return `<div id="rv-top">${rvTop()}</div><div class="result" style="margin-top:1rem"><b>今出せるカードは、ここまで</b><div class="note">次の学習中のカードは <span id="rvwait">${rvWaitText(r.wait)}</span> に出る。時間になれば、そのまま出てくる。</div></div><div class="row"><button class="btn" data-rvnow>今すぐ出す</button><button class="btn ghost" data-rvend>やめる</button>${r.hist.length ? '<button class="btn ghost" data-rvundo>元に戻す</button>' : ""}</div>`;
  if (!r.cur) return rvDone();
  return `<div id="rv-top">${rvTop()}</div><div class="cardbox rvf" id="rv-box"><span id="rv-ov">${rvOv()}</span><iframe class="rvframe" id="rv-frame" title="カード" srcdoc="${esc(FRAME_DOC())}"></iframe></div><div id="rv-ctl">${rvCtl()}</div>`; }
/* 復習の画面は、カードの枠(iframe)を作り直さずに使い回す:表→裏で中身だけを差し替える */
let rvFrameEl = null;
function mountReview(){ const r = V.rv; if (!r) return; const c = rvCur(), fr = $("rv-frame"); if (!fr || !c) return; rvFrameEl = fr;
  const key = c.id + "|" + r.back + "|" + r.done; if (fr.dataset.k === key) return; fr.dataset.k = key; showInFrame(fr, c, r.back); }
/* 判定でノートの欄を自動で書き換える */
const AUTO_RULES = [ ["", "書き換えない"], ["pagelog", "カードに出た値を、その回の復習の記録に残す(欄には書かない)"], ["time", "この回の時間"], ["grade", "判定(× △ ○ ◎)"], ["log", "記録に足す(日付・時間・判定を上に1行)"], ["best", "最高記録(正解したときの最短)"], ["count", "回数"], ["page", "カードの中に出た値を、最後に足す"], ["okng", "○×を最後に足す(もう一度=×、ほかは○)"] ];
const CALC_RULES = [ ["", "作らない(保存してある中身のまま)"], ["okng", "○×の並び(もう一度=×、ほかは○)"], ["grades", "評価の並び(× △ ○ ◎)"], ["laps", "その回にカードに出た値の並び(前の中身のあとに続ける)"], ["secs", "かかった秒の並び"], ["count", "復習した回数"], ["last", "前回の判定と時間"] ];
/* ノートタイプを、AIに見せやすい1つの文に(欄・Anki2の設定・全部のカードの種類の表と裏・CSS)。同じ形で返ってきたものは、そのまま取り込める */
const FENCE = "```";
function ntToText(t){ const lbl = (L, cur) => (L.find(x => x[0] === String(cur || "").split("|")[0]) || [0, ""])[1];
  const auto = t.fields.filter(f => (t.auto || {})[f]).map(f => "  - " + f + ":" + lbl(AUTO_RULES, t.auto[f])), calc = t.fields.filter(f => (t.calc || {})[f]).map(f => "  - " + f + ":" + lbl(CALC_RULES, t.calc[f]));
  return ["# ノートタイプ:" + t.name, "", "## 欄(この順)", t.fields.map((f, i) => (i + 1) + ". " + f).join("\n"), "", "## Anki2 の設定", "- 重複を見る欄:" + A2.dupKeys(t).join("・"), "- 自動で書き換える欄:" + (auto.length ? "\n" + auto.join("\n") : "なし"), "- 欄を記録から作る:" + (calc.length ? "\n" + calc.join("\n") : "なし"), "",
    ...t.tmpls.flatMap((m, i) => ["## カードの種類 " + (i + 1) + ":" + m.name, "### 表", FENCE + "html", m.q, FENCE, "### 裏", FENCE + "html", m.a, FENCE, ""]),
    "## CSS", FENCE + "css", t.css || "", FENCE, "",
    "## (参考)Anki2 で使えるもの", "- テンプレートに {{A2:正誤}}(○×の並び) {{A2:評価}}(× △ ○ ◎の並び) {{A2:時間}}(かかった秒) {{A2:回数}} {{A2:前回}} {{A2:記録}} を書ける", "- JavaScript から window.A2CARD を読める:{ id, back, state, reps, lapses, ivl, stability, difficulty, history:[{ t, grade(1〜4), sec, x }] }", "- 表から裏へは同じページのまま中身を差し替える(Ankiと同じ)。表で作った window の値は裏に残る", "- 直したものは、この文と同じ形(「## カードの種類 N:名前」「### 表」「### 裏」「## CSS」とコードブロック)で返すと、Anki2 にそのまま取り込める"].join("\n"); }
function parseNtText(text){ const out = { tmpls: [], css: null }; const lines = String(text || "").replace(/\r/g, "").split("\n"); let cur = null, side = null, inCode = false, buf = [];
  const flush = () => { if (side === "css") out.css = buf.join("\n"); else if (cur && side) cur[side] = buf.join("\n"); buf = []; };
  for (const l of lines) { if (inCode) { if (/^```\s*$/.test(l)) { inCode = false; flush(); side = side === "css" ? null : side; } else buf.push(l); continue; }
    let m; if ((m = /^##\s*カードの種類\s*(\d+)\s*[::]?\s*(.*)$/.exec(l))) { cur = { n: +m[1], name: m[2].trim() }; out.tmpls.push(cur); side = null; continue; }
    if (/^##\s*CSS/i.test(l)) { cur = null; side = "css"; continue; } if (/^##\s/.test(l)) { cur = null; side = null; continue; }
    if (/^###\s*表/.test(l)) { side = "q"; continue; } if (/^###\s*裏/.test(l)) { side = "a"; continue; }
    if (/^```/.test(l) && (side === "q" || side === "a" || side === "css")) { inCode = true; buf = []; continue; } }
  return out; }
/* カードのページの中から値を読む(dojo math の「記録欄に追記」など) */
function pageValue(sel){ try { const d = rvFrameEl && rvFrameEl.contentDocument, el = d && d.querySelector(sel || "#dojo-rec-input"); if (!el) return ""; return String(el.value != null && el.tagName !== "DIV" ? el.value : el.textContent || "").trim(); } catch (e) { return ""; } }
const appendList = (old, add) => { const o = String(old || "").replace(/(<br\s*\/?>|\s)+$/i, ""), a = String(add || "").replace(/^[\s,、]+/, ""); return !a ? o : (A2.emptyField(o) ? a : o + ", " + a); };
const secOf = v => { const m = /(\d+):(\d{1,2})/.exec(String(v || "")); return m ? +m[1] * 60 + +m[2] : null; };
function autoWrite(note, nt, k, sec){ const rules = nt.auto || {}; if (!Object.values(rules).some(Boolean)) return null; const mark = ["", "×", "△", "○", "◎"][k], tm = mmss(sec), day = A2.dayStr(A2.today()); const before = JSON.stringify(note.f);
  Object.entries(rules).forEach(([f, rr0]) => { const rr = String(rr0 || "").split("|")[0], arg = String(rr0 || "").split("|")[1]; if (!rr || rr === "pagelog" || !nt.fields.includes(f)) return;
    if (rr === "page") { const v = pageValue(arg); if (v) note.f[f] = appendList(note.f[f], v); return; } if (rr === "okng") { note.f[f] = appendList(note.f[f], k === 1 ? "×" : "○"); return; }
    if (rr === "time") note.f[f] = tm; else if (rr === "grade") note.f[f] = mark;
    else if (rr === "log") note.f[f] = [day + " " + tm + " " + mark].concat(String(note.f[f] || "").split(/<br\s*\/?>/i).filter(x => x.trim())).slice(0, 12).join("<br>");
    else if (rr === "best") { if (k >= 3) { const old = secOf(note.f[f]); if (old == null || sec < old) note.f[f] = tm; } } else if (rr === "count") note.f[f] = String((+note.f[f] || 0) + 1); });
  if (JSON.stringify(note.f) === before) return null; note.mod = Date.now(); return tm + " " + mark; }
async function answer(k){ const r = V.rv, c = rvCur(); if (!c) return; const now = Date.now(), note = A2.S.notes.get(c.nid), nt = A2.S.notetypes.get(note.nt), sec = (now - (r.cardT0 || r.t0)) / 1000;
  const ivs = A2.nextWaits(c), o = ivs[k - 1], snap = { c: JSON.parse(JSON.stringify(c)), f: JSON.parse(JSON.stringify(note.f)), mi: r.mi, cur: r.cur, curMain: r.curMain, done: r.done, again: r.again, sibs: [] };
  const wrote = autoWrite(note, nt, k, sec); if (wrote) toast("記録を書き換えた(" + wrote + ")");
  const last = c.st === "復習" ? c.ivl : 0, today = A2.dayOf(now);
  Object.assign(c, { s: o.s, d: o.d, st: o.st, step: o.step, reps: (c.reps || 0) + 1, lastDay: today, mod: now }); if (o.lapse) c.lapses = (c.lapses || 0) + 1;
  if (o.st === "復習") { c.ivl = o.ivl; c.dueDay = today + o.ivl; delete c.dueMs; } else { c.dueMs = now + o.wait * 60e3; if (k === 1) r.again++; }
  if (c.st === "新規") delete c.pos;
  const opt = A2.optOf(c);
  if (o.lapse && c.lapses >= (+opt.leech || 8) && !note.tags.includes("leech")) { note.tags.push("leech"); toast("何度も忘れているので「leech」のタグを付けた(作り直しを考えるとよい)"); }
  if (opt.burySib) for (const s of A2.S.cards.values()) if (s.nid === c.nid && s.id !== c.id && !s.susp && (s.st === "新規" || s.st === "復習")) { snap.sibs.push(JSON.parse(JSON.stringify(s))); s.bury = true; s.buryDay = today; }
  const rl = { id: "r" + now, cid: c.id, t: now, g: k, ivl: o.st === "復習" ? o.ivl : -Math.round(o.wait * 60), last, ms: Math.round(sec * 1000), kind: snap.c.st === "新規" || snap.c.st === "学習中" ? 0 : snap.c.st === "再学習" ? 2 : 1 };
  rl.src = "a2"; if (r.px) rl.x = Object.assign({}, r.px); if (r.pSec) { rl.x = Object.assign(rl.x || {}, { shownSec: Math.round(sec) }); rl.ms = Math.round(r.pSec * 1000); } snap.px = r.px; snap.pSec = r.pSec; snap.sug = r.sug; r.px = null; r.pSec = null; r.sug = null;
  Object.values(nt.auto || {}).forEach(r0 => { const [rr, arg] = String(r0 || "").split("|"); if (rr === "pagelog") { const v = pageValue(arg).replace(/^[\s,、]+/, ""); if (v) rl.x = Object.assign(rl.x || {}, { page: v }); } });
  snap.rl = rl.id; r.hist.push(snap);
  await A2.save("cards", [c].concat(snap.sibs.map(x => A2.S.cards.get(x.id)))); await A2.save("notes", [note]); await A2.save("revlog", [rl]);
  r.answered.add(c.id); if (r.curMain) r.mi++; r.cur = null; r.done++; r.back = false; se("g" + k); rvEnsure(); if (!r.cur && !r.wait) se("done"); render(); }
async function undo(){ const r = V.rv, h = r && r.hist.pop(); if (!h) return; const c = A2.S.cards.get(h.c.id), note = A2.S.notes.get(c.nid); if (rvFrameEl) rvFrameEl.dataset.k = "";
  Object.keys(c).forEach(k => { if (!(k in h.c)) delete c[k]; }); Object.assign(c, h.c); note.f = h.f; h.sibs.forEach(s => A2.S.cards.set(s.id, s));
  r.px = h.px || null; r.pSec = h.pSec || null; r.sug = h.sug || null; r.answered.delete(c.id); r.mi = h.mi; r.cur = h.cur; r.curMain = h.curMain; r.wait = null; r.done = h.done; r.again = h.again; r.back = true; r.cardT0 = Date.now();
  await A2.save("cards", [c].concat(h.sibs)); await A2.save("notes", [note]); await A2.remove("revlog", [h.rl]); se("undo"); toast("ひとつ前に戻した"); render(); }
/* 声 */
const VOICE = { on: false, rec: null, last: "" };
function voiceStart(){ const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) { toast("このブラウザでは、声の聞き取りが使えない"); render(); return; }
  const rr = new SR(); rr.lang = "ja-JP"; rr.continuous = true; rr.interimResults = true; rr.maxAlternatives = 3;
  /* 聞き取りの途中(まだ確定していない文字)も見て、決まった言葉がまるごと聞こえた時点で動く。同じ発言では二度動かない */
  rr.onresult = e => { for (let i = e.resultIndex; i < e.results.length; i++) { const res = e.results[i], key = VOICE.sess + ":" + i;
      const alts = [...Array(res.length)].map((_, k) => res[k].transcript.trim()).filter(Boolean); if (!alts.length) continue; VOICE.last = alts[0];
      if (VOICE.finalKey === key) { VOICE.fired = null; VOICE.finalKey = null; }   // 確定したあとに同じ番号で来たら、それは次の発言(Android はこうなる)
      if (VOICE.fired === key) { if (res.isFinal) VOICE.finalKey = key; continue; }
      const hit = alts.map(voiceMatch).find(Boolean);
      if (hit) { VOICE.fired = key; if (res.isFinal) VOICE.finalKey = key; voiceDo(hit); } else if (res.isFinal) { VOICE.finalKey = key; render(); } else paintVoice(); } };
  rr.onstart = () => { VOICE.sess = (VOICE.sess || 0) + 1; };
  rr.onend = () => { if (VOICE.on) { try { rr.start(); } catch (e) {} } };
  rr.onerror = e => { if (/not-allowed|service-not-allowed|audio-capture/.test(e.error)) { VOICE.on = false; toast("マイクが使えない(ブラウザの許可が必要)"); render(); } };
  VOICE.rec = rr; VOICE.on = true; VOICE.last = ""; try { rr.start(); } catch (e) {} render(); }
function voiceStop(quiet){ VOICE.on = false; try { VOICE.rec && VOICE.rec.stop(); } catch (e) {} VOICE.rec = null; if (!quiet) render(); }
/* 聞こえた文字から、どの操作か(言葉がまるごと入っているときだけ) */
function voiceMatch(t){ const s = String(t).replace(/[\s。、!！?？]/g, "");
  if (/やめる|やめて|終わり|おわり/.test(s)) return "end"; if (/元に戻す|もとにもどす|戻して|もどして/.test(s)) return "undo";
  if (/^(表|おもて)$/.test(s) || /表に戻/.test(s)) return "face";
  if (/もう一度|もういちど|もう一回|もういっかい|わからない|忘れた|わすれた/.test(s)) return "g1"; if (/難しい|むずかしい|むずい/.test(s)) return "g2";
  if (/簡単|かんたん/.test(s)) return "g4"; if (/正解|せいかい|オッケー|OK|できた/i.test(s)) return "g3";
  if (/答え|こたえ|答|応え|堪え|めくる|めくって|^裏$|^うら$|裏を|アンサー|^次$|^つぎ$/.test(s)) return "show"; return null; }
/* 聞こえている文字を、その場で書き換える(画面全体は描き直さない) */
function paintVoice(){ const el = document.querySelector(".vstat b.vheard"); if (el) el.textContent = "聞こえている「" + (VOICE.last || "") + "」"; else { const v = document.querySelector(".vstat"); if (v) { const b = document.createElement("b"); b.className = "vheard"; b.textContent = "聞こえている「" + (VOICE.last || "") + "」"; v.appendChild(b); } } }
function voiceDo(cmd){ const r = V.rv; if (!r || !rvCur()) { render(); return; }
  if (cmd === "end") { endStudy(); return; } if (cmd === "undo") { undo(); return; }
  if (cmd === "face") { if (r.back) { r.back = false; se("flip"); render(); } return; }
  if (cmd === "show") { if (!r.back) { r.back = true; se("flip"); render(); } return; }
  const k = +cmd.slice(1); if (!r.back) r.back = true; answer(k); }
function voiceCmd(t){ const m = voiceMatch(t); if (m) voiceDo(m); else render(); }
function endStudy(){ voiceStop(true); wakeOff(); rvFrameEl = null; try { document.fullscreenElement && document.exitFullscreen(); } catch (e) {} go({ rv: null }); }

/* ───── ブラウザ ───── */
function cardFront(c){ return String(A2.cardHtml(c, false)).replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]*>/g, " ").replace(/\[sound:[^\]]+\]/g, "🔊").replace(/\s+/g, " ").trim().slice(0, 50); }
function match(c, q){ const n = A2.S.notes.get(c.nid), d = A2.S.decks.get(c.deck), nt = n && A2.S.notetypes.get(n.nt); if (!n || !d) return false;
  return q.split(/\s+/).filter(Boolean).every(tok => { const neg = tok.startsWith("-"), t = neg ? tok.slice(1) : tok, m = /^(deck|tag|is|flag|note|prop|added|rated):(.+)$/i.exec(t); let ok;
    if (!m) ok = Object.values(n.f).join(" ").replace(/<[^>]*>/g, "").toLowerCase().includes(t.toLowerCase());
    else { const k = m[1].toLowerCase(), v = m[2].toLowerCase(), today = A2.today();
      if (k === "deck") ok = new RegExp("^" + v.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "(::|$)", "i").test(d.name);
      else if (k === "tag") ok = n.tags.some(x => x.toLowerCase() === v || x.toLowerCase().startsWith(v + "::") || (v.endsWith("*") && x.toLowerCase().startsWith(v.slice(0, -1))));
      else if (k === "is") ok = { new: c.st === "新規", learn: c.st === "学習中" || c.st === "再学習", review: c.st === "復習", due: A2.isDue(c), suspended: !!c.susp, buried: !!c.bury, marked: n.tags.includes("marked") }[v] || false;
      else if (k === "flag") ok = String(c.flag || 0) === v; else if (k === "note") ok = nt && nt.name.toLowerCase().includes(v);
      else if (k === "added") ok = [...A2.S.revlog.values()].length >= 0 && (Date.now() - (parseInt(String(c.id).replace(/\D/g, "").slice(0, 13)) || 0)) / 86400e3 <= +v;
      else if (k === "rated") ok = [...A2.S.revlog.values()].some(r => r.cid === c.id && today - A2.dayOf(r.t) < +v);
      else if (k === "prop") { const pm = /^(ivl|reps|lapses|due)(>=|<=|>|<|=)(-?\d+)$/.exec(v); if (pm) { const val = pm[1] === "due" ? (c.dueDay != null ? c.dueDay - today : 1e9) : (c[pm[1]] || 0), x = +pm[3]; ok = { ">": val > x, "<": val < x, ">=": val >= x, "<=": val <= x, "=": val === x }[pm[2]]; } else ok = false; } }
    return neg ? !ok : ok; }); }
const BCHIPS = [ ["new", "新規", c => c.st === "新規"], ["learn", "学習中", c => c.st === "学習中" || c.st === "再学習"], ["review", "復習", c => c.st === "復習"], ["due", "今日の分", c => A2.isDue(c)], ["susp", "一時停止", c => !!c.susp], ["flag", "旗あり", c => !!c.flag], ["marked", "印", (c, n) => n.tags.includes("marked")], ["leech", "leech", (c, n) => n.tags.includes("leech")], ["rated", "今日復習した", c => A2._ratedToday && A2._ratedToday.has(c.id)], ["lapse", "忘れやすい(3回以上)", c => (c.lapses || 0) >= 3] ];
function bfMatch(c){ const f = V.bf || {}, n = A2.S.notes.get(c.nid), d = A2.S.decks.get(c.deck); if (!n || !d) return false;
  if (f.deck && !(d.name === f.deck || d.name.startsWith(f.deck + "::"))) return false; if (f.nt && n.nt !== f.nt) return false; if (f.tag && !n.tags.some(t => t === f.tag || t.startsWith(f.tag + "::"))) return false;
  const on = BCHIPS.filter(([k]) => (f.chips || {})[k]); if (!on.length) return true;
  const stateKeys = ["new", "learn", "review"], st = on.filter(([k]) => stateKeys.includes(k)), other = on.filter(([k]) => !stateKeys.includes(k));
  return (!st.length || st.some(([, , fn]) => fn(c, n))) && other.every(([, , fn]) => fn(c, n)); }
function bfBar(){ const f = V.bf || (V.bf = { chips: {} }), today = A2.today(); A2._ratedToday = new Set([...A2.S.revlog.values()].filter(r => A2.dayOf(r.t) === today).map(r => r.cid));
  const prefixes = [...new Set([...A2.S.decks.values()].flatMap(d => d.name.split("::").map((_, i, a) => a.slice(0, i + 1).join("::"))))].sort((a, b) => a.localeCompare(b, "ja"));
  const tags = [...new Set([...A2.S.notes.values()].flatMap(n => n.tags))].sort((a, b) => a.localeCompare(b, "ja")), any = f.deck || f.nt || f.tag || Object.values(f.chips || {}).some(Boolean);
  return `<div class="bfbar"><div class="bfsel"><select id="bf-deck"><option value="">すべてのデッキ</option>${prefixes.map(p => `<option value="${esc(p)}"${f.deck === p ? " selected" : ""}>${"　".repeat(p.split("::").length - 1)}${esc(p.split("::").pop())}</option>`).join("")}</select>
      <select id="bf-nt"><option value="">すべてのノートタイプ</option>${[...A2.S.notetypes.values()].map(t => `<option value="${t.id}"${f.nt === t.id ? " selected" : ""}>${esc(t.name)}</option>`).join("")}</select>
      <select id="bf-tag"><option value="">すべてのタグ</option>${tags.map(t => `<option value="${esc(t)}"${f.tag === t ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></div>
    <div class="bfchips">${BCHIPS.map(([k, l]) => `<button data-bchip="${k}" aria-pressed="${!!(f.chips || {})[k]}">${l}</button>`).join("")}${any ? '<button class="linkx" data-bfclear>絞り込みを消す</button>' : ""}</div></div>`; }
function browser(){ let xs = [...A2.S.cards.values()].filter(c => bfMatch(c) && match(c, V.bq)); const today = A2.today();
  const key = { due: c => c.st === "新規" ? 1e12 + (c.pos || 0) : c.dueDay != null ? c.dueDay : 0, ivl: c => -(c.ivl || 0), deck: c => (A2.S.decks.get(c.deck) || {}).name || "", front: c => cardFront(c), lapses: c => -(c.lapses || 0) }[V.bsort] || (c => 0);
  xs.sort((a, b) => { const x = key(a), y = key(b); return x < y ? -1 : x > y ? 1 : 0; }); V.blist = xs.map(c => c.id); const sel = Object.keys(V.bsel).filter(k => V.bsel[k]), shown = xs.slice(0, V.bmax || 200);
  const bar = bfBar();
  return `<div class="bsearch"><input id="bq" placeholder="言葉で探す(表・裏・欄の中身)" value="${esc(V.bq)}"></div>${bar}
    <details class="syn"><summary>くわしい書き方(使わなくてよい)</summary>書き方:<code>deck:英語*</code> <code>tag:単語帳</code> <code>is:due</code> <code>is:new</code> <code>is:suspended</code> <code>flag:1</code> <code>prop:ivl&gt;20</code> <code>rated:1</code> <code>-tag:xx</code>(除く)</details>
    <div class="bsort">並べ方 <select id="bsort">${[["due", "次の復習"], ["ivl", "間隔の長い順"], ["lapses", "忘れた回数"], ["deck", "デッキ"], ["front", "表の文字"]].map(([k, t]) => `<option value="${k}"${V.bsort === k ? " selected" : ""}>${t}</option>`).join("")}</select><span style="margin-left:auto">${xs.length}枚${sel.length ? "・" + sel.length + "枚を選んでいる" : ""}</span>${xs.length ? (sel.length === xs.length ? '<button class="linkx" data-bact="none" style="margin-left:.6rem">選ぶのをやめる</button>' : `<button class="linkx" data-ball style="margin-left:.6rem">全部選ぶ(${xs.length}枚)</button>`) : ""}</div>
    ${sel.length ? `<div class="bact"><button class="btn sm" data-bact="deck">デッキを変える</button><button class="btn ghost sm" data-bact="tag">タグを足す</button><button class="btn ghost sm" data-bact="susp">一時停止の切り替え</button><button class="btn ghost sm" data-bact="flag">旗</button><button class="btn ghost sm" data-bact="reset">新規に戻す</button><button class="btn ghost sm" data-bact="del" style="color:var(--shu)">消す</button><button class="linkx" data-bact="none">選ぶのをやめる</button></div>` : ""}
    <div class="btable">${shown.map(c => { const d = A2.S.decks.get(c.deck), n = A2.S.notes.get(c.nid), nt = A2.S.notetypes.get(n.nt), st = c.susp ? "一時停止" : c.st;
      return `<div class="brow"><input type="checkbox" data-bsel="${c.id}"${V.bsel[c.id] ? " checked" : ""} aria-label="選ぶ"><button data-card="${c.id}" style="border:0;background:none;text-align:left;padding:0"><b>${esc(cardFront(c)) || "(表が空)"}</b><span class="stt s-${st === "復習" ? "習熟" : st === "新規" ? "新規" : "復習中"}">${st}</span>${c.flag ? ` <span class="fl" style="background:${FL[c.flag]}"></span>` : ""}<div class="meta">${esc(d.name)}・${esc(nt ? nt.name : "")}</div></button><span class="due">${c.st === "新規" ? "まだ" : c.dueDay != null ? (c.dueDay - today <= 0 ? "今日" : (c.dueDay - today) + "日後") : "今日"}<br>間隔 ${c.ivl || 0}日</span></div>`; }).join("") || '<p class="note" style="padding:.5rem .7rem;margin:0">見つからない。</p>'}</div>
    ${xs.length > shown.length ? `<button class="madd" data-bmore>あと ${xs.length - shown.length} 枚を出す</button>` : ""}`; }

/* ───── 作る ───── */
let ADD = { nt: null, deck: null, f: {}, tags: "", side: "表", use: "暗記" };
const memNts = () => [...A2.S.notetypes.values()].filter(t => (t.use || "暗記") === "暗記").sort((a, b) => a.name.localeCompare(b.name, "ja"));
function make(){ if (!A2.S.decks.size) return '<div class="empty-big"><b>まだデッキがない</b>暗記の「+ 分野」でデッキを作るか、その他 › 読み込みで Ankiの書き出しを読み込む。</div>';
  if (!A2.S.notetypes.size) return '<div class="empty-big"><b>まだノートタイプがない</b>先に Ankiの書き出しを読み込む(その他 › 読み込み)と、そのノートタイプで作れます。</div>';
  const top = `<div class="kseg">${["暗記", "AI"].map(u => `<button data-adduse="${u}" aria-pressed="${ADD.use === u}">${u === "AI" ? "AIのツール" : "カードを作る"}<small>${u === "AI" ? "ツールを開く・出したものを取り込む" : "ノートタイプを選んで書く"}</small></button>`).join("")}</div>`;
  if (ADD.use === "AI") return top + aiHtml();
  const nts = memNts(); if (!ADD.nt || !A2.S.notetypes.has(ADD.nt)) ADD.nt = (A2.S.meta.lastNt && A2.S.notetypes.has(A2.S.meta.lastNt)) ? A2.S.meta.lastNt : nts[0].id; if (!ADD.deck || !A2.S.decks.has(ADD.deck)) ADD.deck = A2.S.meta.lastDeck && A2.S.decks.has(A2.S.meta.lastDeck) ? A2.S.meta.lastDeck : [...A2.S.decks.values()][0].id;
  const t = A2.S.notetypes.get(ADD.nt), dup = !A2.emptyField(ADD.f[t.fields[0]]) && A2.isDup(t, ADD.f);
  return top + `<div class="mkgrid"><div class="mkform"><div class="f"><label>ノートタイプ</label><select id="ad-nt">${nts.map(x => `<option value="${x.id}"${x.id === ADD.nt ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select></div>
      <div class="f"><label>デッキ</label><select id="ad-dk">${[...A2.S.decks.values()].sort((a, b) => a.name.localeCompare(b.name, "ja")).map(d => `<option value="${d.id}"${d.id === ADD.deck ? " selected" : ""}>${esc(d.name)}</option>`).join("")}</select></div>
      ${t.fields.map((f, i) => (i === 8 ? `<details class="morefld"${V.morefld ? " open" : ""}><summary>ほかの欄(${t.fields.length - 8})</summary>` : "") + `<div class="f fld"><label>${esc(f)}${i === 0 && dup ? ` <b style="color:var(--shu)">もうある(${A2.dupKeys(t).map(esc).join("と")}が同じ)</b>` : ""}</label><textarea data-afld="${esc(f)}" rows="2">${esc(ADD.f[f] || "")}</textarea>
        <div class="fbtns"><button data-ains="\\(|\\)" data-af="${esc(f)}">数式 \\( \\)</button><button data-ains="\\[|\\]" data-af="${esc(f)}">数式(行)</button>${t.cloze ? `<button data-acloze="${esc(f)}">穴 [...]</button>` : ""}<button data-ains="<b>|</b>" data-af="${esc(f)}">太字</button></div></div>` + (i === t.fields.length - 1 && i >= 8 ? "</details>" : "")).join("")}
      <div class="f"><label>タグ(空白で区切る)</label><input id="ad-tags" value="${esc(ADD.tags)}" style="width:100%;padding:.4rem .5rem;border:1px solid var(--rule);border-radius:3px"></div>
      <div class="row" style="margin-top:.7rem"><button class="btn" data-addnote>追加</button></div></div>
    <div class="mkprev"><div class="mkph">出来上がり</div><div class="mksw">${["表", "裏"].map(k => `<button data-mkside="${k}" aria-pressed="${ADD.side === k}">${k}</button>`).join("")}</div><div class="cardbox rvf"><iframe class="rvframe" id="ad-frame" title="出来上がり" srcdoc="${esc(FRAME_DOC())}" style="min-height:10rem"></iframe></div><div class="note" id="ad-need"></div></div></div>`; }
function addPreview(){ const fr = $("ad-frame"); if (!fr) return; const t = A2.S.notetypes.get(ADD.nt), fake = { id: "pv", nid: "pvn", ord: 0, deck: ADD.deck }; A2.S.notes.set("pvn", { id: "pvn", nt: ADD.nt, f: ADD.f, tags: (ADD.tags || "").split(/\s+/).filter(Boolean) });
  const ords = A2.genOrds(A2.S.notes.get("pvn"), t); fake.ord = ords[0] || 0; showInFrame(fr, fake, ADD.side === "裏").then(() => { A2.S.notes.delete("pvn"); });
  const need = $("ad-need"); if (need) need.textContent = ords.length ? (ords.length > 1 ? "カードが " + ords.length + " 枚できる" : "") : "まだ表が空なので、カードができない(欄を入れると出る)"; }
/* AIのツール:リンクと、出したもの(Ankiに読み込む形)の取り込み */
const links = () => A2.S.meta.links || [ { id: "L1", name: "英単語カードづくり2", url: "https://claude.ai/artifact/2d5kf3gHiWHd25vmR6W7dF", memo: "英単語・瞬間英作文・文法。「全部コピー」して下に貼る" }, { id: "L2", name: "数学カードづくり", url: "https://claude.ai/artifact/BMVT7jZYvEozHWUNrQ9BUM", memo: "問題と解答の画像から、骨組みと dojo math。「全部コピー」して下に貼る" } ];
let AI = { out: "", deck: null };
function parseImport(text){ const SEP = { pipe: "|", tab: "\t", comma: ",", semicolon: ";", space: " " }; const blocks = []; let cur = null;
  String(text || "").replace(/```[a-z]*/gi, "").split(/\r?\n/).forEach(l => { const line = l.replace(/\s+$/, ""); if (!line.trim()) return; const m = /^#([a-z ]+):(.*)$/i.exec(line);
    if (m) { if (!cur || cur.rows.length) { cur = { sep: null, nt: "", deck: "", cols: null, tagCol: 0, rows: [] }; blocks.push(cur); } const k = m[1].trim().toLowerCase(), v = m[2].trim();
      if (k === "separator") cur.sep = SEP[v.toLowerCase()] || v; else if (k === "notetype") cur.nt = v; else if (k === "deck") cur.deck = v; else if (k === "columns") cur.cols = v.split(cur.sep || "|"); else if (k === "tags column") cur.tagCol = +v || 0; return; }
    if (!cur) { cur = { sep: null, nt: "", deck: "", cols: null, tagCol: 0, rows: [] }; blocks.push(cur); } cur.rows.push(line.split(cur.sep || (line.includes("\t") ? "\t" : "|"))); });
  return blocks.map(b => { const nt = [...A2.S.notetypes.values()].find(x => x.name === b.nt) || memNts()[0], deck = [...A2.S.decks.values()].find(x => x.name === b.deck) || A2.S.decks.get(AI.deck) || [...A2.S.decks.values()][0];
    const fields = b.cols || nt.fields.concat(b.tagCol ? ["Tags"] : []), warn = [];
    const notes = b.rows.map((r, i) => { const f = {}; let tags = []; if (r.length !== fields.length) warn.push((i + 1) + "行目:欄が " + r.length + " 個(" + fields.length + " 個のはず)"); fields.forEach((c, j) => { const v = (r[j] || "").trim(); if ((b.tagCol && j === b.tagCol - 1) || c === "Tags") tags = v.split(/\s+/).filter(Boolean); else if (nt.fields.includes(c)) f[c] = v; }); nt.fields.forEach(x => { if (f[x] == null) f[x] = ""; }); return { f, tags, dup: A2.isDup(nt, f) }; });
    return { nt, deck, ntName: b.nt, deckName: b.deck, notes, warn }; }); }
function aiHtml(){ const ims = AI.out.trim() ? parseImport(AI.out) : [];
  return `<h2 style="margin-top:.6rem">AIのツール<small>claude.ai で自動で作ってくれるもの</small></h2><div class="links">${links().map(l => `<div class="lk"><a class="lka" href="${esc(l.url)}" target="_blank" rel="noopener"><b>${esc(l.name)}</b><span>${esc(l.memo || l.url)}</span><i>開く ↗</i></a><button class="mmore" data-lkedit="${l.id}" aria-label="直す">⋯</button></div>`).join("")}<button class="madd" data-lknew>+ ツールを足す</button></div>
    <h2>取り込む<small>ツールが出したもの(Ankiに読み込む形)を、そのまま貼る</small></h2><div class="aibox"><div class="f"><label>入れる先のデッキ(貼ったものにデッキが書いていないとき)</label><select id="ai-dk">${[...A2.S.decks.values()].sort((a, b) => a.name.localeCompare(b.name, "ja")).map(d => `<option value="${d.id}"${d.id === AI.deck ? " selected" : ""}>${esc(d.name)}</option>`).join("")}</select></div>
    <textarea id="ai-out" rows="6" placeholder="#separator:Pipe&#10;#notetype:和訳&#10;#deck:…&#10;#columns:…">${esc(AI.out)}</textarea>
    ${ims.map((im, bi) => `<div class="aiim"><div class="note">${ims.length > 1 ? (bi + 1) + "つ目:" : ""}ノートタイプ <b>${esc(im.nt.name)}</b>${im.ntName && im.ntName !== im.nt.name ? `(「${esc(im.ntName)}」がないので、これにする)` : ""}・デッキ <b>${esc(im.deck.name)}</b>${im.deckName && im.deckName !== im.deck.name ? `(「${esc(im.deckName)}」は新しく作る)` : ""}・${im.notes.length}枚${im.notes.filter(n => n.dup).length ? `・<b style="color:var(--shu)">もうあるもの ${im.notes.filter(n => n.dup).length}</b>` : ""}・重複は「${A2.dupKeys(im.nt).map(esc).join("と")}」が同じもの</div>
      ${im.warn.length ? `<div class="mkneed" style="margin:.3rem 0">${im.warn.slice(0, 4).map(esc).join("<br>")}</div>` : ""}
      <div class="aiil">${im.notes.slice(0, 40).map(n => `<div class="aiir${n.dup ? " dup" : ""}"><b>${esc(String(n.f[im.nt.fields[0]] || "").replace(/<[^>]*>/g, "").slice(0, 40))}</b><span>${esc(String(n.f[im.nt.fields[1]] || "").replace(/<[^>]*>/g, "").slice(0, 40))}</span>${n.dup ? "<em>もうある</em>" : ""}</div>`).join("")}</div></div>`).join("")}
    ${ims.length ? `<div class="row" style="margin-top:.5rem"><button class="btn" data-aiimport>${ims.reduce((a, im) => a + im.notes.filter(n => !n.dup).length, 0)}枚を取り込む</button>${ims.some(im => im.notes.some(n => n.dup)) ? '<label class="note"><input type="checkbox" id="ai-dup"> もうあるものも取り込む</label>' : ""}</div>` : ""}</div>`; }
async function addNoteNow(ntId, deckId, f, tags){ const nt = A2.S.notetypes.get(ntId), now = Date.now(), note = { id: "n" + now + Math.floor(Math.random() * 1000), guid: A2.uid(), nt: ntId, f: Object.assign({}, f), tags, mod: now };
  const ords = A2.genOrds(note, nt); if (!ords.length) return 0; let pos = Math.max(0, ...[...A2.S.cards.values()].map(c => c.pos || 0)) + 1;
  const cards = ords.map(o => ({ id: "c" + now + "_" + o + Math.floor(Math.random() * 1000), nid: note.id, deck: deckId, ord: o, st: "新規", pos: pos++, ivl: 0, reps: 0, lapses: 0, flag: 0, mod: now }));
  await A2.save("notes", [note]); await A2.save("cards", cards); return cards.length; }
async function ensureDeck(name){ let d = [...A2.S.decks.values()].find(x => x.name === name); if (d) return d; d = { id: "d" + Date.now() + Math.floor(Math.random() * 1000), name, opt: A2.defaultOpt() }; await A2.save("decks", [d]);
  if (![...A2.S.subjects.values()].some(s => s.name === name.split("::")[0])) await A2.save("subjects", [{ id: "s" + A2.uid(), name: name.split("::")[0], cat: V.cat, c: "#2F4F8A" }]); return d; }

/* ───── 統計(本物の復習の記録から) ───── */
function bars(vals, opt){ const W = 340, H = opt.h || 110, n = vals.length || 1, mx = Math.max(1, ...vals.map(v => Array.isArray(v) ? v.reduce((a, b) => a + b, 0) : v)), bw = W / n;
  return `<svg viewBox="0 0 ${W} ${H + 16}">${vals.map((v, i) => { const arr = Array.isArray(v) ? v : [v]; let y = H; return arr.map((x, k) => { const h = x / mx * (H - 4); y -= h; return `<rect x="${(i * bw + bw * .12).toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * .76).toFixed(1)}" height="${h.toFixed(1)}" fill="${(opt.colors || ["var(--wave)"])[k]}" rx="1"/>`; }).join(""); }).join("")}<line x1="0" y1="${H}" x2="${W}" y2="${H}" stroke="var(--rule)"/>${(opt.ticks || []).map(([i, t]) => `<text x="${(i * bw + bw / 2).toFixed(1)}" y="${H + 12}" font-size="9" text-anchor="middle" fill="var(--sub)">${t}</text>`).join("")}<text x="2" y="9" font-size="9" fill="var(--sub)">${mx}</text></svg>`; }
function lineChart(series, o){ const W = 340, H = o.h || 130, P = 26, X = x => P + (W - P - 6) * Math.min(Math.max(x, 0), o.xmax) / o.xmax, Y = y => 6 + (H - 22) * (1 - (Math.min(Math.max(y, o.ymin), o.ymax) - o.ymin) / (o.ymax - o.ymin));
  return `<svg viewBox="0 0 ${W} ${H}">${(o.yt || []).map(v => `<line x1="${P}" x2="${W - 6}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--rule)" stroke-dasharray="2 3"/><text x="${P - 3}" y="${Y(v) + 3}" font-size="8" text-anchor="end" fill="var(--sub)">${Math.round(v * 100)}%</text>`).join("")}${(o.xt || []).map(([v, t]) => `<text x="${X(v)}" y="${H - 6}" font-size="8" text-anchor="middle" fill="var(--sub)">${t}</text>`).join("")}${series.map(s => `<polyline fill="none" stroke="${s.c}" stroke-width="${s.w || 2}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ""} points="${s.pts.map(([x, y]) => X(x).toFixed(1) + "," + Y(y).toFixed(1)).join(" ")}"/>${s.dots ? s.pts.map(([x, y]) => `<circle cx="${X(x)}" cy="${Y(y)}" r="3" fill="${s.c}"/>`).join("") : ""}`).join("")}</svg>`; }
function statsScopeSel(){ const sc = V.stScope || "all", subs = [...A2.S.subjects.values()].sort((a, b) => a.name.localeCompare(b.name, "ja")), decks = [...A2.S.decks.values()].map(d => d.name).sort((a, b) => a.localeCompare(b, "ja"));
  return `<div class="stscope"><select id="st-scope"><option value="all"${sc === "all" ? " selected" : ""}>全部</option><optgroup label="分類">${CATS.map(c => `<option value="cat:${c.id}"${sc === "cat:" + c.id ? " selected" : ""}>${c.name}</option>`).join("")}</optgroup>
    <optgroup label="分野">${subs.map(s => `<option value="deck:${esc(s.name)}"${sc === "deck:" + s.name ? " selected" : ""}>${esc(s.name)}</option>`).join("")}</optgroup><optgroup label="デッキ">${decks.filter(n => n.includes("::")).map(n => `<option value="deck:${esc(n)}"${sc === "deck:" + n ? " selected" : ""}>${esc(n.replace(/::/g, " › "))}</option>`).join("")}</optgroup></select>
    <select id="st-days">${[[30, "1か月"], [90, "3か月"], [365, "1年"], [3650, "全部"]].map(([v, l]) => `<option value="${v}"${(V.stDays || 90) === v ? " selected" : ""}>${l}</option>`).join("")}</select></div>`; }
function stats(){ const today = A2.today(), sc = V.stScope || "all";
  const inScope = d => { if (!d) return false; if (sc === "all") return true; if (sc.startsWith("cat:")) { const s = [...A2.S.subjects.values()].find(x => x.name === d.name.split("::")[0]); return s && s.cat === sc.slice(4); } const nm = sc.slice(5); return d.name === nm || d.name.startsWith(nm + "::"); };
  const cards = [...A2.S.cards.values()].filter(c => inScope(A2.S.decks.get(c.deck))), cset = new Set(cards.map(c => c.id)), rv = [...A2.S.revlog.values()].filter(r => cset.has(r.cid)), days = V.stDays || 90;
  if (!A2.S.cards.size) return '<div class="empty-big"><b>まだカードがない</b></div>';
  if (!cards.length) return statsScopeSel() + '<p class="note">この範囲には、カードがない。</p>';
  const byDay = new Map(); rv.forEach(r => { const d = A2.dayOf(r.t); if (!byDay.has(d)) byDay.set(d, { tot: 0, again: 0, ms: 0, nw: 0 }); const x = byDay.get(d); x.tot++; if (r.g === 1) x.again++; x.ms += r.ms || 0; if (r.kind === 0) x.nw++; });
  const t0 = byDay.get(today) || { tot: 0, again: 0, ms: 0 }, last30 = [...byDay.entries()].filter(([d]) => today - d < 30).map(([, x]) => x), tot30 = last30.reduce((a, x) => a + x.tot, 0), ag30 = last30.reduce((a, x) => a + x.again, 0);
  let streak = 0; while (byDay.has(today - streak)) streak++;
  const span = Math.min(days, Math.max(30, today - Math.min(today, ...rv.map(r => A2.dayOf(r.t))) + 1)), step = span > 120 ? 7 : 1, nb = Math.ceil(span / step);
  const past = Array.from({ length: nb }, (_, i) => { let a = 0, b2 = 0, c2 = 0; for (let k = 0; k < step; k++) { const x = byDay.get(today - span + 1 + i * step + k); if (x) { a += x.tot - x.again - x.nw; b2 += x.nw; c2 += x.again; } } return [a, b2, c2]; });
  const fut = Array.from({ length: 30 }, (_, i) => cards.filter(c => !c.susp && c.st === "復習" && c.dueDay != null && (i === 0 ? c.dueDay <= today : c.dueDay === today + i)).length);
  const sts = ["新規", "学習中", "再学習", "復習"].map(k => cards.filter(c => c.st === k && !c.susp).length).concat(cards.filter(c => c.susp).length);
  const withS = cards.filter(c => c.s && c.st === "復習"), Rnow = c => A2.R(Math.max(0, today - (c.lastDay != null ? c.lastDay : today)), c.s), rb = [0, 0, 0, 0, 0, 0]; withS.forEach(c => { rb[Math.min(5, Math.max(0, Math.floor((Rnow(c) - .5) / .1)))]++; });
  /* 予測は当たっているか:記録を順にたどって、各復習の直前に予測した確率と、実際に思い出せたか */
  const byCard = new Map(); rv.forEach(r => { if (!byCard.has(r.cid)) byCard.set(r.cid, []); byCard.get(r.cid).push(r); }); const bins = Array.from({ length: 8 }, () => ({ n: 0, ok: 0 }));
  byCard.forEach(list => { let S = null, D = null, last = null; list.sort((a, b) => a.t - b.t).forEach(r => { if (r.g < 1 || r.g > 4 || r.kind === 4) return; const day = A2.dayOf(r.t);
    if (S != null && day !== last) { const R = A2.R(day - last, S), b = Math.min(7, Math.max(0, Math.floor((R - .6) / .05))); if (R >= .6) { bins[b].n++; if (r.g > 1) bins[b].ok++; } }
    const m = A2.replay(list.filter(x => x.t <= r.t)); if (m) { S = m.s; D = m.d; last = m.lastDay; } }); });
  const cal = bins.map((b, i) => [.6 + i * .05 + .025, b.n ? b.ok / b.n : null]).filter(x => x[1] != null && bins[Math.round((x[0] - .625) / .05)].n >= 3);
  return statsScopeSel() + `<div class="kpis"><div><small>今日の復習</small><b>${t0.tot}</b>枚</div><div><small>かかった時間</small><b>${Math.round(t0.ms / 60000)}</b>分</div><div><small>正答率(30日)</small><b>${tot30 ? Math.round((1 - ag30 / tot30) * 100) : "—"}</b>%</div><div><small>連続日数</small><b>${streak}</b>日</div></div>
    <div class="chart"><h4>これからの復習の予測<small>今後30日</small></h4>${bars(fut, { ticks: [[0, "今日"], [7, "1週"], [14, "2週"], [29, "30日"]] })}</div>
    <div class="chart"><h4>復習した数<small>${step > 1 ? "1週ごと・" : ""}${{ 30: "1か月", 90: "3か月", 365: "1年", 3650: "全部" }[days] || ""}</small></h4>${bars(past, { colors: ["var(--ok)", "var(--wave)", "var(--shu)"], ticks: [[0, A2.dayStr(today - span + 1)], [nb - 1, "今日"]] })}<div class="lg"><span style="--c:var(--ok)">復習</span><span style="--c:var(--wave)">新規・学習</span><span style="--c:var(--shu)">もう一度</span></div></div>
    <div class="chart"><h4>カードの状態</h4>${bars(sts, { ticks: [[0, "新規"], [1, "学習中"], [2, "再学習"], [3, "復習"], [4, "一時停止"]], h: 80 })}</div>
    <h2>FSRS<small>覚え具合の計算を見える形にする</small></h2>
    <div class="chart"><h4>今、思い出せる確率<small>復習中のカード ${withS.length}枚</small></h4>${bars(rb, { ticks: [[0, "〜60%"], [1, "60〜"], [2, "70〜"], [3, "80〜"], [4, "90〜"], [5, "100%"]], h: 70 })}</div>
    <div class="chart"><h4>予測は当たっているか<small>自分の復習の記録から</small></h4>${cal.length >= 2 ? lineChart([{ pts: [[.6, .6], [1, 1]], c: "var(--rule)", dash: "4 3", w: 1.5 }, { pts: cal, c: "var(--ok)", dots: true }], { xmax: 1, ymin: .55, ymax: 1, yt: [.6, .7, .8, .9, 1], xt: [[.6, "予測 60%"], [.8, "80%"], [1, "100%"]] }) + '<p class="note" style="margin:.2rem 0 0">点が点線に近いほど、FSRSの予測が当たっている。</p>' : '<p class="note">まだ記録が少ないので描けない(復習の記録つきで読み込むか、しばらく使うと出る)。</p>'}</div>`; }

/* ───── 下から出る画面 ───── */
function sheetHtml(){ const sh = V.sheet; if (!sh) return ""; const xs = window.exSheet && exSheet(sh); if (xs != null) return xs;
  if (sh.k === "sync") return window.syncSheet ? syncSheet() : "";
  if (sh.k === "more") return `<h3>その他</h3><div class="mlist">${[["sync", "同期", "スマホ・Chromebook・Mac で同じデータを使う"], ["import", "読み込み", "Ankiの書き出し(.apkg・.colpkg)"], ["backup", "書き出し(控え)", "暗記と演習の全部を1つのファイルに保存する"], ["restore", "控えから戻す", "書き出した控えのファイルから"], ["autobk", "自動の控え", "毎日1回、この端末に取っている控え(7日分)から戻す"], ["empty", "空のカード", "表に欄の中身が1つも出ないカードを探して消す(ノートは消さない)"], ["check", "データの点検", "おかしなところを探して直す"], ["errlog", "起きた問題の記録", "エラーの内容(直すときの手がかり)"], ["nts", "ノートタイプ", "欄・重複を見る欄・自動で書き換える欄・テンプレート"], ["prefs", "設定", "効果音・音声の自動再生"]].map(([k, t, d]) => `<button data-more="${k}"><b>${t}</b><small>${d}</small></button>`).join("")}</div><p class="note">Anki2 ${APP_VERSION}・カード ${A2.S.cards.size}枚・ノート ${A2.S.notes.size}・記録 ${A2.S.revlog.size}${A2.S.meta.persisted ? "・この端末に保存(消されにくい設定)" : ""}</p>`;
  if (sh.k === "import") return `<h3>Ankiから読み込む</h3><p class="note" style="margin-top:0">Ankiで「書き出す」→「スケジュール情報を含める」「メディアを含める」にして作ったファイルを選ぶ。何度読み込んでも重ならない(同じノート・カードは1つにまとめ、新しいほうを残す。記録は足すだけ)。</p><div class="imp"><label class="btn shu" style="cursor:pointer">ファイルを選ぶ<input type="file" id="imp-file" accept=".apkg,.colpkg,application/zip" hidden></label><div class="steplog" id="imp-log"></div></div>`;
  if (sh.k === "prefs") return `<h3>設定</h3><label class="chk" style="border:0"><input type="checkbox" id="pf-se"${A2.S.meta.se === false ? "" : " checked"}> 効果音を鳴らす</label><label class="chk" style="border:0"><input type="checkbox" id="pf-ap"${A2.S.meta.autoplay === false ? "" : " checked"}> 音声を自動で再生する</label>`;
  if (sh.k === "dopt") { const d = A2.S.decks.get(sh.id), o = Object.assign(A2.defaultOpt(), d.opt || {}); const f = (k, t, v, s) => `<div class="f"><label>${t}</label><input data-opt="${k}" value="${esc(v)}" style="width:100%;padding:.4rem .5rem;border:1px solid var(--rule);border-radius:3px">${s ? `<div class="note">${s}</div>` : ""}</div>`;
    return `<h3>デッキのオプション</h3><div class="f"><label>場所と名前(「::」で区切る。いちばん左が分野)</label><input id="do-name" value="${esc(d.name)}" style="width:100%;padding:.4rem .5rem;border:1px solid var(--rule);border-radius:3px"><div class="note">例:英語::英単語::単語帳。中のデッキも一緒に動く</div></div>${f("newDay", "1日の新しいカード", o.newDay)}${f("revDay", "1日の復習の上限", o.revDay)}${f("steps", "学習ステップ", o.steps, "例:1m 10m")}${f("relearn", "再学習のステップ", o.relearn)}${f("retention", "覚えておきたい割合(%)", o.retention, "FSRS。高いほど復習が増える")}${f("maxIvl", "最大の間隔(日)", o.maxIvl)}${f("leech", "リーチ(忘れた回数)", o.leech, "この回数忘れたら「leech」のタグを付ける")}
      <label class="chk" style="border:0"><input type="checkbox" data-opt="burySib"${o.burySib ? " checked" : ""}> 兄弟カード(同じノートの別のカード)は次の日へ延期する</label><div class="row"><button class="btn sm" data-optsave="${d.id}">保存</button><button class="btn ghost sm" data-dinfo="${esc(d.name)}">中身を調べる</button><button class="linkx" data-ddel="${d.id}" style="color:var(--shu);margin-left:auto">このデッキを消す</button></div>`; }
  if (sh.k === "subedit") { const s = A2.S.subjects.get(sh.id); return `<h3>分野</h3><div class="f"><label>名前(いちばん上のデッキの名前)</label><input id="su-n" value="${esc(s.name)}" style="width:100%;padding:.4rem .5rem;border:1px solid var(--rule);border-radius:3px"></div><div class="f"><label>分類</label><select id="su-c">${CATS.map(c => `<option value="${c.id}"${c.id === s.cat ? " selected" : ""}>${c.name}</option>`).join("")}</select></div><div class="f"><label>色</label><div class="row">${["#2F4F8A", "#B5432F", "#3D7A55", "#7B4F9A", "#9A6A1E", "#1F7A8C", "#A0522D", "#26221E"].map(c => `<button class="colb${c === s.c ? " on" : ""}" data-nscol="${c}" style="background:${c}" aria-label="色"></button>`).join("")}</div></div><button class="btn" data-susave="${s.id}">保存</button> <button class="btn ghost sm" data-dinfo="${esc(s.name)}">中身を調べる</button>
      <h2>別の分野の中に入れる<small>この分野を、ほかの分野の中のデッキにする</small></h2><div class="row" style="gap:.4rem"><input id="su-into" list="su-list" placeholder="例:英語" style="flex:1;padding:.4rem .5rem;border:1px solid var(--rule);border-radius:3px"><datalist id="su-list">${[...A2.S.subjects.values()].filter(x => x.id !== s.id).map(x => `<option value="${esc(x.name)}">`).join("")}</datalist><button class="btn sm" data-suinto="${s.id}">入れる</button></div>
      <div class="note">「英語」と入れると「${esc(s.name)}」が「英語 › ${esc(s.name)}」になる。英語の分野がなければ作る。</div>
      <h2>この分野を消す</h2>${(() => { const ds = [...A2.S.decks.values()].filter(d => d.name === s.name || d.name.startsWith(s.name + "::")), ids = new Set(ds.map(d => d.id)), n = [...A2.S.cards.values()].filter(c => ids.has(c.deck)).length;
        return ds.length ? `<div class="note">中にデッキ ${ds.length}・カード ${n}枚がある。消すと全部消える(その前に「別の分野の中に入れる」でよそへ動かすこともできる)。</div><button class="btn ghost sm" data-subdel="${s.id}" style="color:var(--shu);border-color:var(--shu);margin-top:.3rem">デッキとカードごと消す</button>` : `<button class="btn ghost sm" data-subdel="${s.id}" style="color:var(--shu);border-color:var(--shu)">この分野を消す(中は空)</button>`; })()}
      ${[...A2.S.decks.values()].some(d => d.name === s.name) ? `<div style="margin-top:.6rem"><button class="linkx" data-dopt="${[...A2.S.decks.values()].find(d => d.name === s.name).id}">「${esc(s.name)}」デッキのオプション(1日の枚数など)</button></div>` : ""}`; }
  if (sh.k === "newsub") return `<h3>分野を作る</h3><div class="f"><label>名前</label><input id="ns-n" placeholder="例:物理" style="width:100%;padding:.4rem .5rem;border:1px solid var(--rule);border-radius:3px"></div><div class="f"><label>分類</label><select id="ns-c">${CATS.map(c => `<option value="${c.id}"${c.id === V.cat ? " selected" : ""}>${c.name}</option>`).join("")}</select></div><button class="btn" data-nssave>作る</button>`;
  if (sh.k === "newdeck") { const subs = [...A2.S.subjects.values()], sid = sh.sid || (subs.find(x => x.cat === V.cat) || subs[0] || {}).id; if (!subs.length) return '<h3>デッキを作る</h3><p class="note">先に分野を作る。</p>'; const s = A2.S.subjects.get(sid), parents = [...A2.S.decks.values()].filter(d => d.name.split("::")[0] === s.name).map(d => d.name.split("::").slice(1).join("::")).filter(Boolean);
    return `<h3>デッキを作る</h3><div class="f"><label>分野</label><select id="nd-s">${subs.map(x => `<option value="${x.id}"${x.id === sid ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select></div><div class="f"><label>どのデッキの中に作るか</label><select id="nd-p"><option value="">(分野のすぐ下)</option>${[...new Set(parents)].map(p => `<option value="${esc(p)}">${esc(p.replace(/::/g, " › "))}</option>`).join("")}</select></div><div class="f"><label>デッキの名前</label><input id="nd-n" style="width:100%;padding:.4rem .5rem;border:1px solid var(--rule);border-radius:3px"></div><button class="btn" data-ndsave>作る</button>`; }
  if (sh.k === "custom") return `<h3>カスタム学習</h3><p class="note" style="margin-top:0">検索の書き方で集めたカードを、今だけ回す。</p><div class="mlist">${[["is:due prop:lapses>2", "忘れやすいカード"], ["flag:1", "赤い旗のカード"], ["rated:1", "今日復習したカード"], ["tag:leech", "何度も忘れたカード(leech)"]].map(([q, t]) => `<button data-custgo="${esc(q)}"><b>${t}</b><small>${esc(q)}</small></button>`).join("")}</div><div class="f" style="margin-top:.5rem"><label>自分で書く</label><input id="cust-q" placeholder="例:deck:英語* is:due" style="width:100%;padding:.4rem .5rem;border:1px solid var(--rule);border-radius:3px"></div><button class="btn sm" data-custgo="">このカードで回す</button>`;
  if (sh.k === "rvmore") { const c = A2.S.cards.get(sh.id), n = A2.S.notes.get(c.nid); return `<h3>このカード</h3><button class="bigedit" data-rvedit><i>✎</i>カードを編集<small>直すと、見た目がすぐ変わる</small></button><div class="flgrid">${["なし", "赤", "橙", "緑", "青", "桃", "水", "紫"].map((t, i) => `<button data-setflag="${i}" aria-pressed="${(c.flag || 0) === i}"><span class="fl" style="background:${FL[i] || "transparent"}"></span>${t}</button>`).join("")}</div>
      <div class="bigacts"><button data-rvmark><i>★</i>${n.tags.includes("marked") ? "印を外す" : "印を付ける"}</button><button data-rvbury><i>⏭</i>明日へ延期</button><button data-rvsusp><i>⏸</i>一時停止</button><button data-rvinfo><i>ⓘ</i>カードの情報</button></div>`; }
  if (sh.k === "flag") return `<h3>旗</h3><div class="flgrid">${["なし", "赤", "橙", "緑", "青", "桃", "水", "紫"].map((t, i) => `<button data-setflag="${i}"><span class="fl" style="background:${FL[i] || "transparent"}"></span>${t}</button>`).join("")}</div>`;
  if (sh.k === "info") { const c = A2.S.cards.get(sh.id), n = A2.S.notes.get(c.nid), today = A2.today(), revs = [...A2.S.revlog.values()].filter(r => r.cid === c.id).sort((a, b) => b.t - a.t);
    return `<h3>カードの情報</h3>${[["デッキ", (A2.S.decks.get(c.deck) || {}).name], ["ノートタイプ", (A2.S.notetypes.get(n.nt) || {}).name], ["状態", c.st + (c.susp ? "(一時停止)" : "")], ["次の復習", c.st === "新規" ? "まだ" : c.dueDay != null ? A2.dayStr(c.dueDay) : "今日"], ["間隔", (c.ivl || 0) + "日"], ["復習した回数", c.reps || 0], ["忘れた回数", c.lapses || 0], ["安定さ(FSRS)", c.s ? (Math.round(c.s * 10) / 10) + "日" : "まだ"], ["難しさ(FSRS)", c.d ? (Math.round(c.d * 10) / 10) + " / 10" : "まだ"], ["今、思い出せる確率", c.s && c.st === "復習" ? Math.round(A2.R(Math.max(0, today - (c.lastDay != null ? c.lastDay : today)), c.s) * 100) + "%" : "—"], ["タグ", n.tags.join(" ")]].map(([k, v]) => `<div class="pkv"><span class="k">${k}</span><span class="v">${esc(v)}</span></div>`).join("")}
      <h2>復習の記録<small>${revs.length}回</small></h2>${revs.slice(0, 30).map(r => `<div class="pkv"><span class="k">${new Date(r.t).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span><span class="v">${["", "もう一度", "難しい", "正解", "簡単"][r.g] || "?"}・${r.ivl > 0 ? r.ivl + "日" : Math.round(-r.ivl / 60) + "分"}・${Math.round((r.ms || 0) / 1000)}秒</span></div>`).join("") || '<p class="note">まだない。</p>'}`; }
  if (sh.k === "card") { const c = A2.S.cards.get(sh.id), n = A2.S.notes.get(c.nid), t = A2.S.notetypes.get(n.nt), list = V.rv ? [] : (V.blist || []), idx = list.indexOf(c.id); if (!sh.draft) sh.draft = Object.assign({}, n.f);
    return `<h3>カードを編集</h3><div class="note">${esc((A2.S.decks.get(c.deck) || {}).name)}・${esc(t.name)}${idx >= 0 ? "・" + (idx + 1) + "/" + list.length : ""}</div>
      <div class="edgrid"><div class="edp"><div class="row" style="margin:.4rem 0"><div class="kseg" style="flex:1;margin:0">${["表", "裏"].map(k => `<button data-pvside="${k}" aria-pressed="${(sh.back ? "裏" : "表") === k}">${k}</button>`).join("")}</div>${idx >= 0 ? `<button class="gear" data-pvnav="-1"${idx > 0 ? "" : " disabled"}>◀</button><button class="gear" data-pvnav="1"${idx < list.length - 1 ? "" : " disabled"}>▶</button>` : ""}</div><div class="cardbox rvf"><iframe class="rvframe" id="pv-frame" title="プレビュー" srcdoc="${esc(FRAME_DOC())}" style="min-height:10rem"></iframe></div></div>
      <div class="edf"><h2>欄<small>直すと、見た目がすぐ変わる</small></h2>${t.fields.map((f, i) => (i === 8 ? `<details class="morefld"><summary>ほかの欄(${t.fields.length - 8})</summary>` : "") + `<div class="f fld"><label>${esc(f)}</label><textarea data-efld="${esc(f)}" rows="2">${esc(sh.draft[f] || "")}</textarea></div>` + (i === t.fields.length - 1 && i >= 8 ? "</details>" : "")).join("")}
      <div class="f"><label>タグ</label><input id="ed-tags" value="${esc(n.tags.join(" "))}" style="width:100%;padding:.4rem .5rem;border:1px solid var(--rule);border-radius:3px"></div><div class="row"><button class="btn sm" data-esave="${n.id}">直す</button><button class="linkx" data-more2="info|${c.id}">カードの情報</button></div></div></div>`; }
  if (sh.k === "nts") return `<h3>ノートタイプ</h3><div class="mlist">${[...A2.S.notetypes.values()].map(t => `<button data-ntopen="${t.id}"><b>${esc(t.name)}</b><small>欄 ${t.fields.length}・カード ${t.tmpls.length}・ノート ${[...A2.S.notes.values()].filter(n => n.nt === t.id).length}</small></button>`).join("") || '<p class="note">まだない。</p>'}</div>`;
  if (sh.k === "nt") { const t = A2.S.notetypes.get(sh.id), ti = sh.ti || 0, side = sh.side || "表", tm = t.tmpls[ti] || t.tmpls[0];
    return `<h3>${esc(t.name)}</h3><button class="linkx" data-more="nts">‹ ノートタイプの一覧</button>
      <div class="row" style="margin:.5rem 0;gap:.5rem"><button class="btn sm shu" data-ntcopy>全部まとめてコピー</button><button class="btn ghost sm" data-ntfile>ファイルで保存</button><button class="btn ghost sm" data-ntpaste>AIが直したものを入れる</button></div>
      <p class="note" style="margin-top:0">欄・設定・全部のカードの種類の表と裏・CSS を1つにまとめる。AIに見せて、直したものを同じ形で返してもらえば、「AIが直したものを入れる」でそのまま入る。</p>
      <h2>重複を見る欄<small>選んだ欄がぜんぶ同じなら「もうある」</small></h2><div class="card dupk">${t.fields.map(f => `<label><input type="checkbox" data-dupk="${esc(f)}"${A2.dupKeys(t).includes(f) ? " checked" : ""}> ${esc(f)}</label>`).join("")}</div>
      <h2>自動で書き換える欄<small>判定したときに、アプリが書き換える</small></h2>${t.fields.includes("記録") && t.fields.includes("正誤") ? '<button class="btn sm shu" data-dojopreset style="margin-bottom:.4rem">dojo math の決まりを入れる</button><div class="note" style="margin:-.2rem 0 .4rem">正誤 ← 毎回の判定から ○×、記録 ← その回にカードに出た「方針/完答」の秒(どちらも復習の記録から作るので、手で書かなくてよい)</div>' : ""}<div class="card">${t.fields.map(f => { const cur = String((t.auto || {})[f] || ""), kind = cur.split("|")[0]; return `<div class="autorow"><span>${esc(f)}</span><select data-autof="${esc(f)}">${AUTO_RULES.map(([v, l]) => `<option value="${v}"${kind === v ? " selected" : ""}>${l}</option>`).join("")}</select></div>${kind === "page" || kind === "pagelog" ? `<div class="autorow"><span class="note">読み取る場所</span><input data-autosel="${esc(f)}" value="${esc(cur.split("|")[1] || "#dojo-rec-input")}" style="max-width:60%;padding:.2rem .3rem;border:1px solid var(--rule);border-radius:4px"></div>` : ""}`; }).join("")}</div>
      <h2>欄を記録から作る<small>表示するたびに、復習の記録(判定・時間)から作る。保存してある中身は変えない</small></h2><div class="card">${t.fields.map(f => `<div class="autorow"><span>${esc(f)}</span><select data-calcf="${esc(f)}">${CALC_RULES.map(([v, l]) => `<option value="${v}"${((t.calc || {})[f] || "") === v ? " selected" : ""}>${l}</option>`).join("")}</select></div>`).join("")}</div>
      <p class="note">テンプレートには {{A2:正誤}} {{A2:評価}} {{A2:時間}} {{A2:回数}} {{A2:前回}} {{A2:記録}} も書ける。JavaScript からは window.A2CARD(判定・時間・安定さなど)。</p>
      <h2>テンプレート<small>${t.tmpls.length}つ</small></h2><div class="ctabs sm">${t.tmpls.map((x, i) => `<button data-nti="${i}" aria-pressed="${ti === i}">${esc(x.name)}</button>`).join("")}</div><div class="kseg">${["表", "裏", "CSS"].map(k => `<button data-ntside="${k}" aria-pressed="${side === k}">${k}</button>`).join("")}</div>
      <textarea class="codeta" id="nt-code" rows="12">${esc(side === "表" ? tm.q : side === "裏" ? tm.a : t.css)}</textarea><div class="row" style="margin-top:.4rem"><button class="btn sm" data-ntsave>直す</button></div>`; }
  if (sh.k === "link") { const l = links().find(x => x.id === sh.id) || { id: sh.id, name: "", url: "", memo: "" }; const inp = (id, v, ph) => `<input id="${id}" value="${esc(v || "")}" placeholder="${ph}" style="width:100%;padding:.4rem .5rem;border:1px solid var(--rule);border-radius:3px">`;
    return `<h3>ツール</h3><div class="f"><label>名前</label>${inp("lk-n", l.name, "例:古文単語カードづくり")}</div><div class="f"><label>URL</label>${inp("lk-u", l.url, "https://claude.ai/artifact/…")}</div><div class="f"><label>メモ</label>${inp("lk-m", l.memo, "")}</div><div class="row"><button class="btn" data-lksave>保存</button>${links().some(x => x.id === sh.id) ? '<button class="linkx" data-lkdel style="color:var(--shu);margin-left:auto">一覧から外す</button>' : ""}</div>`; }
  if (sh.k === "ntpaste") { const t = A2.S.notetypes.get(sh.id), p = sh.text ? parseNtText(sh.text) : null; let diff = [];
    if (p) { p.tmpls.forEach(x => { const m = t.tmpls[x.n - 1]; if (!m) { diff.push("カードの種類 " + x.n + ":このノートタイプにない(入れない)"); return; } if (x.q != null && x.q !== m.q) diff.push("カードの種類 " + x.n + "(" + m.name + ")の表"); if (x.a != null && x.a !== m.a) diff.push("カードの種類 " + x.n + "(" + m.name + ")の裏"); }); if (p.css != null && p.css !== t.css) diff.push("CSS"); }
    return `<h3>AIが直したものを入れる</h3><div class="note">${esc(t.name)}。「全部まとめてコピー」と同じ形のものを貼る(一部のカードの種類だけでもよい)。欄の増減はここでは変えない。</div><textarea id="ntp-t" rows="10" class="codeta" placeholder="## カードの種類 1:…&#10;### 表&#10;${FENCE}html&#10;…">${esc(sh.text || "")}</textarea>
      ${p ? (diff.length ? `<div class="aiim"><div class="note">変わるところ:</div><div class="aiil">${diff.map(x => `<div class="aiir"><b>${esc(x)}</b></div>`).join("")}</div><div class="row" style="margin-top:.4rem"><button class="btn" data-ntpastego>入れる</button><span class="note">入れる前の中身は、自動の控えと「その他 › 書き出し」に残る</span></div></div>` : '<div class="note" style="margin-top:.4rem">変わるところがない(または読み取れる形になっていない)。</div>') : ""}`; }
  if (sh.k === "deckinfo") { const pre = sh.pre, ids = new Set(A2.deckIds(pre)), today = A2.today(), now = Date.now(), cs = [...A2.S.cards.values()].filter(c => ids.has(c.deck)), k = A2.counts(pre), top = [...A2.S.decks.values()].find(d => d.name === pre), o = A2.optOf({ deck: top ? top.id : [...ids][0] });
    const cnt = f => cs.filter(f).length, rv = cs.filter(c => c.st === "復習" && !c.susp), dues = { 今日まで: rv.filter(c => c.dueDay <= today).length, 明日: rv.filter(c => c.dueDay === today + 1).length, "2〜7日後": rv.filter(c => c.dueDay > today + 1 && c.dueDay <= today + 7).length, それより先: rv.filter(c => c.dueDay > today + 7).length };
    const L = cs.filter(c => (c.st === "学習中" || c.st === "再学習") && !c.susp), lnow = L.filter(c => (c.dueMs != null && c.dueMs <= now + 20 * 60e3) || (c.dueMs == null && c.dueDay <= today)).length;
    const cset = new Set(cs.map(c => c.id)), revs = [...A2.S.revlog.values()].filter(r => cset.has(r.cid)), rt = revs.filter(r => A2.dayOf(r.t) === today).length, ry = revs.filter(r => A2.dayOf(r.t) === today - 1).length, nd = (A2.newDoneToday()[pre] || 0);
    const row = (a, b) => `<div class="pkv"><span class="k">${a}</span><span class="v">${b}</span></div>`;
    return `<h3>中身を調べる</h3><div class="note">${esc(pre.replace(/::/g, " › "))}・カード ${cs.length}枚</div><h2>今日出せる数<small>上に出る 新規・学習中・復習</small></h2>${row("新規", k.n + "(新しいカード " + cnt(c => c.st === "新規" && !c.susp) + "枚・1日の上限 " + o.newDay + "・今日もう出した " + nd + ")")}${row("学習中", k.l + "(学習中 " + L.length + "枚のうち、今出せる " + lnow + ")")}${row("復習", k.r + "(1日の上限 " + o.revDay + ")")}
      <h2>復習のカード ${rv.length}枚の期日</h2>${Object.entries(dues).map(([a, b]) => row(a, b + "枚")).join("")}
      <h2>そのほか</h2>${row("一時停止", cnt(c => c.susp) + "枚")}${row("延期(今日)", cnt(c => c.bury && c.buryDay === today) + "枚")}${row("Anki2 で復習した回数", "今日 " + rt + "・昨日 " + ry)}${row("最後の同期", A2.S.meta.lastSync ? new Date(A2.S.meta.lastSync).toLocaleString("ja-JP") : "まだ")}
      <p class="note">Anki と数が合わないときは、この画面をそのまま見せてもらえれば、原因が分かる。</p>`; }
  if (sh.k === "today") return todaySheet();
  if (sh.k === "empty") { const es = A2.emptyCards(), g = new Map(); es.forEach(c => { const n = A2.S.notes.get(c.nid), nt = A2.S.notetypes.get(n.nt), k = nt.name + " › " + ((nt.tmpls[c.ord] || {}).name || "カード " + (c.ord + 1)); (g.get(k) || g.set(k, []).get(k)).push(c); });
    return `<h3>空のカード</h3><p class="note" style="margin-top:0">表をそのノートの欄で描いたとき、欄の中身が1つも出ないカード(Anki の「空のカード」と同じ決まり)。消すのはカードだけで、ノートは消さない。すべてのカードが空になるノートは、最初の1枚を残す。</p>
      ${es.length ? [...g.entries()].map(([k, cs]) => `<div class="pkv"><span class="k">${esc(k)}</span><span class="v">${cs.length}枚<br><small class="note">${cs.slice(0, 3).map(c => esc(String(A2.S.notes.get(c.nid).f[A2.S.notetypes.get(A2.S.notes.get(c.nid).nt).fields[0]] || "").replace(/<[^>]*>/g, "").slice(0, 20))).join("・")}${cs.length > 3 ? "…" : ""}</small></span></div>`).join("") + `<div class="row" style="margin-top:.6rem"><button class="btn" data-emptydel style="background:var(--shu)">${es.length}枚を消す</button></div>` : '<p class="note">空のカードは見つからなかった。</p>'}`; }
  if (sh.k === "msg") return `<h3>${esc(sh.t)}</h3><p>${esc(sh.b)}</p>`;
  if (sh.k === "autobk") return `<h3>自動の控え</h3><p class="note" style="margin-top:0">毎日はじめて開いたときに、この端末の中に控えを取っている(7日分)。戻すと、その日の中身に置き換わり、同期しているならほかの端末にも伝わる。</p><div class="mlist" id="bklist"><p class="note" style="padding:.5rem">読み込み中…</p></div>`;
  if (sh.k === "check") return `<h3>データの点検</h3><div id="chkres" class="note">点検中…</div><p class="note">同期の途中だと、届く途中のカードが「ノートがない」と出ることがある。そのときは同期が「同期済み」になってから、もう一度開く。</p>`;
  if (sh.k === "errlog") { const L = A2.S.meta.errors || []; return `<h3>起きた問題の記録</h3>${L.length ? L.slice().reverse().map(x => `<div class="pkv"><span class="k">${new Date(x.t).toLocaleString("ja-JP")}</span><span class="v" style="font-size:.78rem;word-break:break-all">${esc(x.m)}</span></div>`).join("") + '<button class="linkx" data-errclear>記録を消す</button>' : '<p class="note">まだない。</p>'}`; }
  return ""; }

/* ───── 描く(同じ画面の中では、スクロールの位置と復習のカードの枠を保つ) ───── */
function render(){ shownDay = A2.today(); const y = window.scrollY, exFull = V.mode === "ex" && !V.rv && (typeof EXV !== "undefined") && EXV.run;
  document.body.classList.toggle("fullmode", !!(V.rv || exFull)); document.body.classList.toggle("rvmode", !!V.rv);
  if (V.rv) rvEnsure();
  if (V.rv && V.rv.cur && $("rv-frame")) {   // 復習中:カードの枠には触らず、上の帯と下のボタンだけ描き直す
    $("rv-top").innerHTML = rvTop(); $("rv-ov").innerHTML = rvOv(); $("rv-ctl").innerHTML = rvCtl(); mountReview(); afterRender(y); return; }
  const title = { anki: "暗記", ex: "演習", br: "ブラウザ", make: "作る", st: "統計" }[V.mode];
  const body = V.rv ? review() : V.mode === "anki" ? ankiHome() : V.mode === "ex" ? exView() : V.mode === "br" ? browser() : V.mode === "make" ? make() : stats();
  if (V.rv) { rvFrameEl = null; $("app").innerHTML = `<div class="rvfull" id="rv-wrap">${body}</div>`; mountReview(); }
  else if (exFull) $("app").innerHTML = body;
  else $("app").innerHTML = `<header class="head"><h1>Anki2</h1><small>${APP_VERSION}・${title}${window.syncBadge ? syncBadge() : ""}<button class="hdbtn" data-moreopen>その他</button></small></header>${body}`;
  $("bot").innerHTML = V.rv || exFull ? "" : todayBar() + [["anki", "暗記"], ["ex", "演習"], ["br", "ブラウザ"], ["make", "作る"], ["st", "統計"]].map(([k, t]) => `<button data-bot="${k}" aria-selected="${V.mode === k}">${t}</button>`).join("");
  afterRender(y); }
function afterRender(y){ const old = $("sheetwrap");
  if (V.sheet) { const keep = old && old.dataset.k === V.sheet.k + "|" + (V.sheet.id || "") + "|" + (V.sheet.back ? 1 : 0) + "|" + (V.sheet.ti || 0) + (V.sheet.side || "") && V.sheet.k === "card";
    if (!keep) { if (old) old.remove(); const w = document.createElement("div"); w.id = "sheetwrap"; w.dataset.k = V.sheet.k + "|" + (V.sheet.id || "") + "|" + (V.sheet.back ? 1 : 0) + "|" + (V.sheet.ti || 0) + (V.sheet.side || ""); w.innerHTML = `<div class="sheetbg" data-x></div><div class="sheet${V.sheet.k === "card" ? " wide" : ""}"><button class="close" data-x>閉じる</button>${sheetHtml()}</div>`; document.body.appendChild(w);
      if (V.sheet.k === "card") { const c = A2.S.cards.get(V.sheet.id); showInFrame($("pv-frame"), c, !!V.sheet.back, V.sheet.draft); } } }
  else if (old) old.remove();
  if (V.toast) { const t = document.createElement("div"); t.className = "toast"; t.textContent = V.toast; document.body.appendChild(t); setTimeout(() => t.remove(), 2000); V.toast = ""; }
  if (V.top) { window.scrollTo(0, 0); V.top = false; } else window.scrollTo(0, y);
  if (V.mode === "make" && !V.rv && ADD.use !== "AI") addPreview(); if (window.exDrawMermaid) exDrawMermaid();
  if (V.sheet && V.sheet.k === "autobk" && $("bklist") && !$("bklist").dataset.done) { $("bklist").dataset.done = 1; A2.all("backups").then(l => { const el = $("bklist"); if (el) el.innerHTML = l.sort((a, b) => b.day - a.day).map(x => `<button data-bkgo="${x.id}"><b>${A2.dayStr(x.day)}</b><small>カード ${x.cards}枚・${new Date(x.at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</small></button>`).join("") || '<p class="note" style="padding:.5rem">まだない(明日から取られる)。</p>'; }); }
  if (V.sheet && V.sheet.k === "check" && $("chkres") && !$("chkres").dataset.done) { $("chkres").dataset.done = 1; A2.check(false).then(p => { const el = $("chkres"); if (!el) return; el.innerHTML = p.length ? p.map(esc).join("<br>") + '<div class="row" style="margin-top:.5rem"><button class="btn sm" data-chkfix>直す</button></div>' : "おかしなところは見つからなかった。"; }); }
  if (A2.S.meta.lastErr && !$("errbar")) { const e2 = document.createElement("div"); e2.id = "errbar"; e2.className = "errbar"; e2.innerHTML = `問題が起きた(データは保存されている):${esc(A2.S.meta.lastErr)} <button class="linkx" data-errok>閉じる</button> <button class="linkx" data-reload>再読み込み</button>`; document.body.appendChild(e2); } }

/* デッキを動かす:old で始まるデッキを全部 nw に。行き先の分野がなければ作る。空になった分野は消す */
async function moveDeck(old, nw, like){ const ds = [...A2.S.decks.values()].filter(x => x.name === old || x.name.startsWith(old + "::"));
  if (ds.some(x => { const n2 = nw + x.name.slice(old.length); return [...A2.S.decks.values()].some(y => y.name === n2 && !ds.includes(y)); })) { toast("その場所には、もう同じ名前のデッキがある"); render(); return false; }
  ds.forEach(x => { x.name = nw + x.name.slice(old.length); }); await A2.save("decks", ds);
  const top = nw.split("::")[0]; if (![...A2.S.subjects.values()].some(x => x.name === top)) await A2.save("subjects", [{ id: "s" + A2.uid(), name: top, cat: like ? like.cat : V.cat, c: like ? like.c : "#2F4F8A" }]);
  await pruneSubjects(); return true; }
async function pruneSubjects(){ const tops = new Set([...A2.S.decks.values()].map(d => d.name.split("::")[0])); const gone = [...A2.S.subjects.values()].filter(s => !tops.has(s.name)).map(s => s.id); if (gone.length) await A2.remove("subjects", gone); }
/* ───── 読み込み・控え ───── */
async function doImport(file){ const log = $("imp-log"), say = t => { if (log) log.textContent += t + "\n"; };
  try { if (window.syncNow && A2.S.meta.conn) { say("まず同期して、最新にしている"); await syncNow(); }
    say("読み込み中…"); const pkg = await A2.readPackage(file, say); const res = await A2.mergePackage(pkg, say);
    const used = new Set(pkg.cards.map(c => c.deck)), where = pkg.decks.filter(d => used.has(d.id)).map(d => { const now = (A2.S.decks.get(d.id) || {}).name || d.name; return now.replace(/::/g, " › ") + (now !== d.name ? "(Ankiでは「" + d.name.replace(/::/g, " › ") + "」)" : ""); });
    if (where.length) say("入れたデッキ:" + where.join("、"));
    if (window.syncNow && A2.S.meta.conn) { say("同期している"); syncNow(); }
    say(`終わった:ノートタイプ ${res.notetypes}・デッキ ${res.decks}・ノート ${res.notes}(新しく ${res.newNotes})・カード ${res.cards}・記録 ${res.revlog}・画像と音声 ${res.media}${res.replayed ? "・記録から覚え具合を計算し直した " + res.replayed : ""}${res.fixedDue ? "・期日を直した " + res.fixedDue : ""}${res.revived ? "・前に消したものを戻した " + res.revived : ""}`);
    se("done"); setTimeout(() => { V.sheet = null; toast("読み込んだ:" + (where.length ? where.join("、") : "") + "(カード " + res.cards + "枚・記録 " + res.revlog + ")"); render(); }, 1800); } catch (e) { say("読み込めなかった:" + e.message); console.error(e); } }
async function doBackup(){ const data = { anki2: 1, v: APP_VERSION, at: Date.now() }; for (const n of ["notes", "cards", "revlog", "notetypes", "decks", "subjects", "exsub"]) data[n] = [...A2.S[n].values()]; data.meta = { links: A2.S.meta.links };
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" }), a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "anki2-控え-" + new Date().toISOString().slice(0, 10) + ".json"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); toast("控えを書き出した(画像・音声は入らない)"); render(); }
async function doRestore(file){ try { const d = JSON.parse(await file.text()); if (!d.anki2) throw new Error("Anki2 の控えではない"); if (!confirm("控えの中身に置き換える?(今の中身は消える)")) return;
    await A2.restore(d); toast("控えから戻した"); render(); } catch (e) { alert("戻せなかった:" + e.message); } }

/* ───── 押したとき ───── */
document.addEventListener("click", async e => { if (e.target.closest(".lka")) return; const x = e.target.closest("[data-x]"); if (x) { V.sheet = null; render(); return; } const b = e.target.closest("button"); if (!b || b.disabled) return; const d = b.dataset;
  if (d.bot) { go({ mode: d.bot, sheet: null }); return; }
  if (b.hasAttribute("data-todayopen")) { V.sheet = { k: "today" }; render(); return; }
  if (b.hasAttribute("data-errok")) { A2.S.meta.lastErr = null; const eb = $("errbar"); if (eb) eb.remove(); return; }
  if (b.hasAttribute("data-reload")) { location.reload(); return; }
  if (b.hasAttribute("data-chkfix")) { if (window.SYNC && SYNC.busy) { toast("同期中は直さない。「同期済み」になってから押してください"); render(); return; } if (!confirm("見つかったところを直す?(ノートのないカードは消える)")) return; const p = await A2.check(true); toast(p.length ? "直した:" + p.join("・") : "直すところはなかった"); V.sheet = null; render(); return; }
  if (b.hasAttribute("data-moreopen")) { V.sheet = { k: "more" }; render(); return; }
  if (b.hasAttribute("data-emptydel")) { const es = A2.emptyCards(); if (!es.length || !confirm(es.length + "枚の空のカードを消す?(ノートは消さない。自動の控えから戻せる)")) return; await A2.remove("cards", es.map(c => c.id)); V.sheet = null; toast(es.length + "枚の空のカードを消した"); render(); return; }
  if (b.hasAttribute("data-errclear")) { await A2.setMeta("errors", []); render(); return; }
  if (d.bkgo) { const b0 = await A2.getOne("backups", d.bkgo); if (!b0 || !confirm(A2.dayStr(b0.day) + " の控え(カード " + b0.cards + "枚)に戻す?今の中身は、この控えの中身に置き換わる")) return; await A2.restore(JSON.parse(b0.data)); V.sheet = null; toast("戻した"); render(); return; }
  if (d.more) { if (d.more === "backup") { V.sheet = null; doBackup(); return; } if (d.more === "restore") { const i = document.createElement("input"); i.type = "file"; i.accept = ".json"; i.onchange = () => i.files[0] && doRestore(i.files[0]); i.click(); return; } V.sheet = { k: d.more }; render(); return; }
  if (d.cat) { V.cat = d.cat; render(); return; }
  if (d.dtog) { V.dopen[d.dtog] = V.dopen[d.dtog] === false; render(); return; }
  if (d.study) { startStudy(d.study); return; }
  if (d.oldstudy) { const ids = new Set(A2.deckIds(d.oldstudy)), first = new Map(); for (const r of A2.S.revlog.values()) { const f = first.get(r.cid); if (!f || r.t < f) first.set(r.cid, r.t); } const today = A2.today();
    startStudy(d.oldstudy, c => ids.has(c.deck) && (c.st === "学習中" || c.st === "再学習" || c.st === "復習") && A2.isDue(c) && first.has(c.id) && A2.dayOf(first.get(c.id)) < today, d.oldstudy + "(今日より前に足した分)"); return; }
  if (b.hasAttribute("data-custom")) { V.sheet = { k: "custom" }; render(); return; }
  if (d.custgo != null && b.hasAttribute("data-custgo")) { const q = d.custgo || ($("cust-q") || {}).value || ""; V.sheet = null; startStudy("", c => match(c, q) && !c.susp, "カスタム学習"); return; }
  if (d.dopt) { V.sheet = { k: "dopt", id: d.dopt }; render(); return; }
  if (d.optsave) { const dk = A2.S.decks.get(d.optsave); dk.opt = Object.assign(A2.defaultOpt(), dk.opt || {}); document.querySelectorAll("[data-opt]").forEach(el => { dk.opt[el.dataset.opt] = el.type === "checkbox" ? el.checked : el.value; });
    const nn = String(($("do-name") || {}).value || "").split("::").map(x => x.trim()).filter(Boolean).join("::"); await A2.save("decks", [dk]);
    if (nn && nn !== dk.name) { if (await moveDeck(dk.name, nn) === false) return; } V.sheet = null; toast("保存した"); render(); return; }
  if (d.ddel) { const dk = A2.S.decks.get(d.ddel), cs = [...A2.S.cards.values()].filter(c => c.deck === dk.id); if (!confirm("デッキ「" + dk.name + "」を消す?" + (cs.length ? "(中のカード " + cs.length + "枚も消える)" : ""))) return; await A2.remove("cards", cs.map(c => c.id)); const nids = new Set(cs.map(c => c.nid)); await A2.remove("notes", [...nids].filter(id => ![...A2.S.cards.values()].some(c => c.nid === id))); await A2.remove("decks", [dk.id]); await pruneSubjects(); V.sheet = null; toast("消した"); render(); return; }
  if (d.subedit) { V.sheet = { k: "subedit", id: d.subedit }; render(); return; }
  if (d.nscol) { document.querySelectorAll("[data-nscol]").forEach(z => z.classList.toggle("on", z === b)); return; }
  if (d.susave) { const s = A2.S.subjects.get(d.susave), nn = $("su-n").value.trim(), col = (document.querySelector("[data-nscol].on") || {}).dataset; const ch = [];
    if (nn && nn !== s.name) [...A2.S.decks.values()].forEach(x => { if (x.name === s.name || x.name.startsWith(s.name + "::")) { x.name = nn + x.name.slice(s.name.length); ch.push(x); } });
    Object.assign(s, { name: nn || s.name, cat: $("su-c").value, c: col ? col.nscol : s.c }); await A2.save("subjects", [s]); await A2.save("decks", ch); V.cat = s.cat; V.sheet = null; render(); return; }
  if (d.suinto) { const s = A2.S.subjects.get(d.suinto), into = String($("su-into").value || "").split("::").map(x => x.trim()).filter(Boolean).join("::"); if (!into) { $("su-into").focus(); return; } if (into === s.name) return;
    const tgt = [...A2.S.subjects.values()].find(x => x.name === into.split("::")[0]); if (await moveDeck(s.name, into + "::" + s.name, tgt ? null : s) === false) return; V.cat = (tgt || s).cat; V.sheet = null; toast("「" + s.name + "」を「" + into + "」の中に入れた"); render(); return; }
  if (d.dinfo) { V.sheet = { k: "deckinfo", pre: d.dinfo }; render(); return; }
  if (d.subdel) { const s = A2.S.subjects.get(d.subdel), ds = [...A2.S.decks.values()].filter(x => x.name === s.name || x.name.startsWith(s.name + "::")), ids = new Set(ds.map(x => x.id)), cs = [...A2.S.cards.values()].filter(c => ids.has(c.deck));
    if (cs.length) { if (!confirm("分野「" + s.name + "」の中のデッキ " + ds.length + "・カード " + cs.length + "枚を全部消す?")) return; if (!confirm("本当に消す?(消したあとでも、その他 › 自動の控え から戻せる)")) return; }
    else if (!confirm("分野「" + s.name + "」を消す?")) return;
    if (cs.length) { await A2.remove("cards", cs.map(c => c.id)); const nids = new Set(cs.map(c => c.nid)); await A2.remove("notes", [...nids].filter(id => ![...A2.S.cards.values()].some(c => c.nid === id))); }
    if (ds.length) await A2.remove("decks", ds.map(x => x.id)); await A2.remove("subjects", [s.id]); V.sheet = null; toast("分野「" + s.name + "」を消した"); render(); return; }
  if (b.hasAttribute("data-newsub")) { V.sheet = { k: "newsub" }; render(); return; }
  if (b.hasAttribute("data-nssave")) { const n = $("ns-n").value.trim(); if (!n) return; await A2.save("subjects", [{ id: "s" + A2.uid(), name: n, cat: $("ns-c").value, c: "#2F4F8A" }]); await ensureDeck(n); V.cat = $("ns-c").value; V.sheet = null; se("add"); render(); return; }
  if (d.newdeck != null && b.hasAttribute("data-newdeck")) { V.sheet = { k: "newdeck", sid: d.newdeck }; render(); return; }
  if (b.hasAttribute("data-ndsave")) { const s = A2.S.subjects.get($("nd-s").value), n = $("nd-n").value.trim().replace(/::/g, ""); if (!n) return; const p = $("nd-p").value; await ensureDeck(s.name + "::" + (p ? p + "::" : "") + n); V.sheet = null; se("add"); render(); return; }
  /* 復習 */
  if (b.hasAttribute("data-showans")) { V.rv.back = true; se("flip"); render(); return; }
  if (b.hasAttribute("data-toface")) { V.rv.back = false; se("flip"); render(); return; }
  if (d.grade) { answer(+d.grade); return; }
  if (b.hasAttribute("data-rvend")) { endStudy(); return; }
  if (b.hasAttribute("data-rvundo")) { undo(); return; }
  if (b.hasAttribute("data-voice")) { VOICE.on ? voiceStop() : voiceStart(); return; }
  if (b.hasAttribute("data-rvmore")) { V.sheet = { k: "rvmore", id: rvCur().id }; render(); return; }
  if (b.hasAttribute("data-rvedit")) { V.sheet = { k: "card", id: rvCur().id, back: V.rv.back }; render(); return; }
  if (b.hasAttribute("data-rvinfo")) { V.sheet = { k: "info", id: V.rv ? rvCur().id : V.sheet.id }; render(); return; }
  if (d.setflag != null && b.hasAttribute("data-setflag")) { const ids = V.sheet.ids || [V.sheet.id]; const cs = ids.map(id => A2.S.cards.get(id)); cs.forEach(c => c.flag = +d.setflag); await A2.save("cards", cs); V.sheet = null; render(); return; }
  if (b.hasAttribute("data-rvmark")) { const c = rvCur(), n = A2.S.notes.get(c.nid); n.tags = n.tags.includes("marked") ? n.tags.filter(t => t !== "marked") : n.tags.concat("marked"); await A2.save("notes", [n]); V.sheet = null; se("tick"); render(); return; }
  if (b.hasAttribute("data-rvnow")) { V.rv.force = true; V.rv.wait = null; render(); return; }
  if (b.hasAttribute("data-rvbury") || b.hasAttribute("data-rvsusp")) { const r = V.rv, c = rvCur(); if (b.hasAttribute("data-rvbury")) { c.bury = true; c.buryDay = A2.today(); } else c.susp = true; await A2.save("cards", [c]); r.answered.add(c.id); if (r.curMain) r.mi++; r.cur = null; r.back = false; V.sheet = null; se("tick"); toast(b.hasAttribute("data-rvbury") ? "明日へ延期した" : "一時停止にした"); render(); return; }
  if (d.more2) { const [k, id] = d.more2.split("|"); V.sheet = { k, id }; render(); return; }
  /* ブラウザ・編集 */
  if (d.card) { V.sheet = { k: "card", id: d.card }; render(); return; }
  if (d.pvside) { V.sheet.back = d.pvside === "裏"; render(); return; }
  if (d.pvnav) { const list = V.blist || [], i = list.indexOf(V.sheet.id) + (+d.pvnav); if (list[i]) { V.sheet = { k: "card", id: list[i], back: V.sheet.back }; render(); } return; }
  if (d.esave) { const n = A2.S.notes.get(d.esave); Object.assign(n.f, V.sheet.draft || {}); n.tags = ($("ed-tags").value || "").split(/\s+/).filter(Boolean); n.mod = Date.now(); await A2.save("notes", [n]);
    { const nt = A2.S.notetypes.get(n.nt), mine = [...A2.S.cards.values()].filter(c => c.nid === n.id), have = new Set(mine.map(c => c.ord)), add = A2.genOrds(n, nt).filter(o => !have.has(o));
      if (add.length && mine.length) { let pos = Math.max(0, ...[...A2.S.cards.values()].map(c => c.pos || 0)) + 1; await A2.save("cards", add.map(o => ({ id: "c" + Date.now() + "_" + o + Math.floor(Math.random() * 1000), nid: n.id, deck: mine[0].deck, ord: o, st: "新規", pos: pos++, ivl: 0, reps: 0, lapses: 0, flag: 0 }))); toast("欄が増えたので、カードを " + add.length + "枚足した"); } } V.sheet = null; se("add"); toast("直した"); if (V.rv && rvFrameEl) { rvFrameEl.dataset.k = ""; } render(); return; }
  if (b.hasAttribute("data-ball")) { V.bsel = {}; (V.blist || []).forEach(id => V.bsel[id] = true); render(); return; }
  if (d.bchip) { V.bf = V.bf || { chips: {} }; V.bf.chips = V.bf.chips || {}; V.bf.chips[d.bchip] = !V.bf.chips[d.bchip]; V.bsel = {}; render(); return; }
  if (b.hasAttribute("data-bfclear")) { V.bf = { chips: {} }; V.bq = ""; render(); return; }
  if (b.hasAttribute("data-bmore")) { V.bmax = (V.bmax || 200) + 400; render(); return; }
  if (d.bact) { const ids = Object.keys(V.bsel).filter(k => V.bsel[k]), cs = ids.map(id => A2.S.cards.get(id)).filter(Boolean);
    if (d.bact === "none") V.bsel = {}; else if (d.bact === "susp") { cs.forEach(c => c.susp = !c.susp); await A2.save("cards", cs); } else if (d.bact === "reset") { cs.forEach(c => { Object.assign(c, { st: "新規", ivl: 0, s: null, d: null, pos: 0 }); delete c.dueDay; delete c.dueMs; }); await A2.save("cards", cs); }
    else if (d.bact === "flag") { V.sheet = { k: "flag", ids }; render(); return; } else if (d.bact === "tag") { const t = prompt("足すタグ"); if (t) { const ns = [...new Set(cs.map(c => c.nid))].map(id => A2.S.notes.get(id)); ns.forEach(n => { if (!n.tags.includes(t)) n.tags.push(t); }); await A2.save("notes", ns); } }
    else if (d.bact === "deck") { const nm = prompt("移すデッキの名前(::で区切る)", ""); if (nm) { const dk = await ensureDeck(nm.trim()); cs.forEach(c => c.deck = dk.id); await A2.save("cards", cs); } }
    else if (d.bact === "del") { if (!confirm(cs.length + "枚を消す?")) return; await A2.remove("cards", ids); const nids = new Set(cs.map(c => c.nid)); await A2.remove("notes", [...nids].filter(id => ![...A2.S.cards.values()].some(c => c.nid === id))); V.bsel = {}; }
    toast("まとめて操作した"); render(); return; }
  /* 作る */
  if (d.adduse) { ADD.use = d.adduse; render(); return; }
  if (d.mkside) { ADD.side = d.mkside; document.querySelectorAll("[data-mkside]").forEach(z => z.setAttribute("aria-pressed", String(z === b))); addPreview(); return; }
  if (d.ains) { const ta = document.querySelector(`[data-afld="${CSS.escape(d.af)}"]`), [a1, z1] = d.ains.split("|"), s0 = ta.selectionStart, s1 = ta.selectionEnd; ta.value = ta.value.slice(0, s0) + a1 + ta.value.slice(s0, s1) + z1 + ta.value.slice(s1); ADD.f[d.af] = ta.value; addPreview(); ta.focus(); return; }
  if (d.acloze) { const ta = document.querySelector(`[data-afld="${CSS.escape(d.acloze)}"]`), s0 = ta.selectionStart, s1 = ta.selectionEnd, n = Math.max(0, ...A2.clozeNums(ta.value)) + 1; ta.value = ta.value.slice(0, s0) + "{{c" + n + "::" + ta.value.slice(s0, s1) + "}}" + ta.value.slice(s1); ADD.f[d.acloze] = ta.value; addPreview(); return; }
  if (b.hasAttribute("data-addnote")) { const t = A2.S.notetypes.get(ADD.nt); if (A2.emptyField(ADD.f[t.fields[0]])) { toast("最初の欄を入れてください"); render(); return; } const n = await addNoteNow(ADD.nt, ADD.deck, ADD.f, (ADD.tags || "").split(/\s+/).filter(Boolean)); if (!n) { toast("表が空になるので、カードができない"); render(); return; }
    await A2.setMeta("lastNt", ADD.nt); await A2.setMeta("lastDeck", ADD.deck); ADD.f = {}; se("add"); toast(n + "枚を追加した"); render(); return; }
  if (b.hasAttribute("data-aiimport")) { const ims = parseImport(AI.out), all = ($("ai-dup") || {}).checked; let n = 0; for (const im of ims) { const deck = im.deckName && im.deckName !== im.deck.name ? await ensureDeck(im.deckName) : im.deck; for (const x of im.notes) { if (x.dup && !all) continue; n += await addNoteNow(im.nt.id, deck.id, x.f, x.tags); } } AI.out = ""; se("done"); toast(n + "枚を取り込んだ"); render(); return; }
  if (b.hasAttribute("data-lknew")) { V.sheet = { k: "link", id: "L" + Date.now() }; render(); return; }
  if (d.lkedit) { V.sheet = { k: "link", id: d.lkedit }; render(); return; }
  if (b.hasAttribute("data-lksave")) { const n = $("lk-n").value.trim(), u = $("lk-u").value.trim(); if (!n || !/^https?:\/\//.test(u)) { toast("名前と、https:// で始まるURLを入れてください"); render(); return; } const ls = links().slice(), i = ls.findIndex(x => x.id === V.sheet.id), l = { id: V.sheet.id, name: n, url: u, memo: $("lk-m").value.trim() }; if (i >= 0) ls[i] = l; else ls.push(l); await A2.setMeta("links", ls); V.sheet = null; render(); return; }
  if (b.hasAttribute("data-lkdel")) { await A2.setMeta("links", links().filter(x => x.id !== V.sheet.id)); V.sheet = null; render(); return; }
  /* ノートタイプ */
  if (d.ntopen) { V.sheet = { k: "nt", id: d.ntopen }; render(); return; }
  if (b.hasAttribute("data-ntcopy")) { const t = A2.S.notetypes.get(V.sheet.id), txt = ntToText(t), ok = () => { se("add"); toast("「" + t.name + "」を全部まとめてコピーした(" + txt.length.toLocaleString() + "文字)"); render(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, () => { V.sheet = { k: "ntpaste", id: t.id, text: txt, show: 1 }; toast("コピーできなかったので、ファイルで保存してください"); render(); }); else prompt("コピーしてください", txt); return; }
  if (b.hasAttribute("data-ntfile")) { const t = A2.S.notetypes.get(V.sheet.id), a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([ntToText(t)], { type: "text/markdown" })); a.download = "ノートタイプ-" + t.name.replace(/[\\/:*?"<>|]/g, "_") + ".md"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); return; }
  if (b.hasAttribute("data-ntpaste")) { V.sheet = { k: "ntpaste", id: V.sheet.id }; render(); return; }
  if (b.hasAttribute("data-ntpastego")) { const t = A2.S.notetypes.get(V.sheet.id), p = parseNtText(V.sheet.text); p.tmpls.forEach(x => { const m = t.tmpls[x.n - 1]; if (!m) return; if (x.q != null) m.q = x.q; if (x.a != null) m.a = x.a; }); if (p.css != null) t.css = p.css;
    await A2.save("notetypes", [t]); se("done"); toast("「" + t.name + "」のテンプレートを入れ替えた"); V.sheet = { k: "nt", id: t.id }; render(); return; }
  if (b.hasAttribute("data-dojopreset")) { const nt = A2.S.notetypes.get(V.sheet.id); nt.auto = Object.assign({}, nt.auto || {}, { 記録: "pagelog|#dojo-rec-input", 正誤: "" }); nt.calc = Object.assign({}, nt.calc || {}, { 記録: "laps", 正誤: "okng" }); await A2.save("notetypes", [nt]); se("add"); toast("dojo math の決まりを入れた(正誤・記録は、復習の記録から作る)"); render(); return; }
  if (d.nti) { V.sheet.ti = +d.nti; render(); return; } if (d.ntside) { V.sheet.side = d.ntside; render(); return; }
  if (b.hasAttribute("data-ntsave")) { const t = A2.S.notetypes.get(V.sheet.id), tm = t.tmpls[V.sheet.ti || 0], v = $("nt-code").value, side = V.sheet.side || "表"; if (side === "表") tm.q = v; else if (side === "裏") tm.a = v; else t.css = v; await A2.save("notetypes", [t]); toast("テンプレートを直した"); render(); return; }
});
document.addEventListener("keydown", e => { if (!V.rv || V.sheet || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName)) return; const r = V.rv; if (!rvCur()) return;
  if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (!r.back) { r.back = true; se("flip"); render(); } else answer(3); }
  else if (/^[1-4]$/.test(e.key) && r.back) answer(+e.key);
  else if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); if (!r.back) { r.back = true; se("flip"); render(); } else answer(3); }
  else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); if (r.back) answer(1); }
  else if (e.key === "ArrowUp") { e.preventDefault(); if (r.back) answer(4); } else if (e.key === "ArrowDown") { e.preventDefault(); if (r.back) answer(2); } else if (e.key.toLowerCase() === "b" && r.back) { r.back = false; render(); } else if (e.key.toLowerCase() === "z") undo(); else if (e.key.toLowerCase() === "e") { V.sheet = { k: "card", id: rvCur().id, back: r.back }; render(); } });
document.addEventListener("input", e => { const t = e.target;
  if (t.id === "bq") { V.bq = t.value; clearTimeout(window.__bq); window.__bq = setTimeout(() => { const p = t.selectionStart; render(); const el = $("bq"); if (el) { el.focus(); el.setSelectionRange(p, p); } }, 250); }
  if (t.dataset && t.dataset.afld) { ADD.f[t.dataset.afld] = t.value; clearTimeout(window.__ap); window.__ap = setTimeout(addPreview, 200); }
  if (t.id === "ad-tags") ADD.tags = t.value;
  if (t.id === "ntp-t" && V.sheet && V.sheet.k === "ntpaste") { V.sheet.text = t.value; clearTimeout(window.__ntp); window.__ntp = setTimeout(() => { const p0 = t.selectionStart; const w = $("sheetwrap"); if (w) w.remove(); render(); const el = $("ntp-t"); if (el) { el.focus(); el.setSelectionRange(p0, p0); } }, 400); }
  if (t.dataset && t.dataset.efld && V.sheet && V.sheet.k === "card") { V.sheet.draft[t.dataset.efld] = t.value; clearTimeout(window.__ep); window.__ep = setTimeout(() => showInFrame($("pv-frame"), A2.S.cards.get(V.sheet.id), !!V.sheet.back, V.sheet.draft), 200); }
  if (t.id === "ai-out") { AI.out = t.value; clearTimeout(window.__ai); window.__ai = setTimeout(() => { const y = scrollY, p0 = t.selectionStart; render(); const el = $("ai-out"); if (el) { el.focus(); el.setSelectionRange(p0, p0); } scrollTo(0, y); }, 350); } });
document.addEventListener("change", async e => { const t = e.target;
  if (t.id === "imp-file" && t.files[0]) doImport(t.files[0]);
  if (t.dataset && t.dataset.bsel) { V.bsel[t.dataset.bsel] = t.checked; render(); }
  if (t.id === "bsort") { V.bsort = t.value; render(); }
  if (["bf-deck", "bf-nt", "bf-tag"].includes(t.id)) { V.bf = V.bf || { chips: {} }; V.bf[t.id.slice(3)] = t.value; V.bsel = {}; render(); }
  if (t.id === "st-scope") { V.stScope = t.value; render(); } if (t.id === "st-days") { V.stDays = +t.value; render(); }
  if (t.id === "ad-nt") { ADD.nt = t.value; ADD.f = {}; render(); } if (t.id === "ad-dk") ADD.deck = t.value; if (t.id === "ai-dk") { AI.deck = t.value; render(); }
  if (t.id === "pf-se") await A2.setMeta("se", t.checked); if (t.id === "pf-ap") await A2.setMeta("autoplay", t.checked);
  if (t.dataset && t.dataset.dupk && V.sheet && V.sheet.k === "nt") { const nt = A2.S.notetypes.get(V.sheet.id), set = new Set(A2.dupKeys(nt)); t.checked ? set.add(t.dataset.dupk) : set.delete(t.dataset.dupk); nt.dupKeys = nt.fields.filter(f => set.has(f)); if (!nt.dupKeys.length) nt.dupKeys = [nt.fields[0]]; await A2.save("notetypes", [nt]); render(); }
  if (t.dataset && t.dataset.calcf && V.sheet && V.sheet.k === "nt") { const nt = A2.S.notetypes.get(V.sheet.id); nt.calc = Object.assign({}, nt.calc || {}, { [t.dataset.calcf]: t.value }); await A2.save("notetypes", [nt]); toast("保存した"); render(); }
  if (t.dataset && t.dataset.autosel && V.sheet && V.sheet.k === "nt") { const nt = A2.S.notetypes.get(V.sheet.id), kind0 = String((nt.auto || {})[t.dataset.autosel] || "page").split("|")[0]; nt.auto = Object.assign({}, nt.auto || {}, { [t.dataset.autosel]: kind0 + "|" + (t.value.trim() || "#dojo-rec-input") }); await A2.save("notetypes", [nt]); toast("保存した"); }
  if (t.dataset && t.dataset.autof && V.sheet && V.sheet.k === "nt") { const nt = A2.S.notetypes.get(V.sheet.id); nt.auto = Object.assign({}, nt.auto || {}, { [t.dataset.autof]: t.value }); await A2.save("notetypes", [nt]); toast("保存した"); render(); } });
document.addEventListener("toggle", e => { if (e.target.classList && e.target.classList.contains("morefld")) V.morefld = e.target.open; }, true);
/* 日付が変わったら(切り替わりは午前4時)、または アプリに戻ってきたら、今日の数を数え直す。開きっぱなしでも、朝には今日の分が出る */
let shownDay = null;
function refreshIfNewDay(force){ const t = A2.today(); if (t === shownDay && !force) return; paceCache = null;
  if (!V.rv && !V.sheet && !(typeof EXV !== "undefined" && EXV.run)) render(); }
setInterval(() => refreshIfNewDay(false), 60000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refreshIfNewDay(true); });
window.addEventListener("focus", () => refreshIfNewDay(true));
/* Androidの戻る:復習中は、アプリから抜けずに復習をやめる */
history.pushState({ a2: 1 }, ""); window.addEventListener("popstate", () => { if (V.sheet) { V.sheet = null; render(); } else if (V.rv) endStudy(); else if ((typeof EXV !== "undefined") && EXV.run) { if (EXV.run.done || EXV.run.sec < 30 || confirm("記録せずに演習をやめる?")) exEnd(); } else if (V.mode === "ex" && (typeof EXV !== "undefined") && (EXV.mat || EXV.sub)) { if (EXV.mat) EXV.mat = null; else EXV.sub = null; render(); } history.pushState({ a2: 1 }, ""); });
/* エラーが起きても画面は残し、上に理由を出す。内容は端末に残す(直すときの手がかり) */
function logErr(m){ try { const L = (A2.S.meta.errors || []).concat({ t: Date.now(), m: String(m).slice(0, 500), v: APP_VERSION }).slice(-30); A2.S.meta.errors = L; A2.S.meta.lastErr = String(m).slice(0, 160); if (A2.db) A2.put("meta", [{ k: "errors", v: L }]); const eb = $("errbar"); if (eb) eb.remove(); afterRenderErr(); } catch (e) {} }
function afterRenderErr(){ try { const e2 = document.createElement("div"); e2.id = "errbar"; e2.className = "errbar"; e2.innerHTML = `問題が起きた(データは保存されている):${esc(A2.S.meta.lastErr)} <button class="linkx" data-errok>閉じる</button> <button class="linkx" data-reload>再読み込み</button>`; document.body.appendChild(e2); } catch (e) {} }
window.addEventListener("error", e => logErr((e.message || "") + " @" + (e.filename || "").split("/").pop() + ":" + e.lineno));
window.addEventListener("unhandledrejection", e => logErr("(非同期) " + ((e.reason && (e.reason.stack || e.reason.message)) || e.reason)));
async function boot(){ shownDay = null; const vers = { core: (window.A2 || {}).VER, app: APP_VERSION, ex: window.APP_VER_EX, sync: window.APP_VER_SYNC };
  if (Object.values(vers).some(v => v !== APP_VERSION)) { $("app").innerHTML = `<p class="notice">ファイルの版がそろっていない(${Object.entries(vers).map(([k, v]) => k + ":" + (v || "なし")).join("・")})。置き換えの途中かもしれないので、少し待ってから再読み込みしてください。データはそのまま残っている。</p><button class="btn" data-reload>再読み込み</button>`; return; }
  try { await A2.open(); await A2.loadAll(); } catch (e) { $("app").innerHTML = '<p class="notice">この端末のブラウザに保存できない:' + esc(e.message) + "</p>"; return; } render();
  /* 開いたときの点検は、知らせるだけで、何も変えない(同期の途中だと、届く途中のカードを消してしまうため) */
  setTimeout(async () => { try { await pruneSubjects(); await A2.autoBackup(); } catch (e) { logErr(e.message); } }, 3000);
  setTimeout(async () => { try { if (window.SYNC && SYNC.busy) return; const p = await A2.check(false); if (p.length) { toast("データの点検で気になるところがある(その他 › データの点検)"); render(); } } catch (e) { logErr(e.message); } }, 60000);
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {}); }
/* 全部のファイルを読み終えてから始める(版がそろっているかを確かめるため) */
let booted = false; const boot1 = () => { if (!booted) { booted = true; boot(); } };
if (document.readyState === "complete") boot1(); else { document.addEventListener("DOMContentLoaded", boot1); window.addEventListener("load", boot1); }
