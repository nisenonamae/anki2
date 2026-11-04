/* Anki2 演習 — 材料(問題集・ばらの問題)・解法の地図・結果・画面いっぱいの演習。データは分野ごとに A2.S.exsub */
"use strict";
window.APP_VER_EX = "r4.7";
const EXK = [ ["常に", "常に意識", "読んでいるあいだ、ずっと意識すること"], ["もし", "もし〜なら", "何かに出会ったら、こうする"], ["型", "問題の型", "この型の問題が出たら、こう解く"], ["手順", "手順", "この順番で進める"] ];
let EXV = { sub: null, tab: "材料", area: null, kind: "常に", mat: null, run: null, mopen: {}, mstep: {}, adding: false };
const exDoc = sid => A2.S.exsub.get(sid) || { id: sid, mats: [], loose: [], map: [], hist: [] };
const exSave = doc => A2.save("exsub", [doc]);
const exSubj = () => A2.S.subjects.get(EXV.sub);
const exMat = (doc, mid) => mid === "loose" ? { id: "loose", name: "ばらの問題", items: doc.loose, area: null } : doc.mats.find(m => m.id === mid);
const exStat = items => ({ o: items.filter(x => x.s === "○").length, t: items.filter(x => x.s === "△").length, x: items.filter(x => x.s === "×").length, all: items.length });
const exNext = m => m.items.find(x => !x.s);
const exTm = sec => Math.floor(sec / 60) + "分" + (sec % 60 ? String(sec % 60).padStart(2, "0") + "秒" : "");
const exAreas = doc => [...new Set(doc.map.map(x => x.area).concat(doc.areas || []))];
const exNode = (doc, id, path) => { let n = doc.map.find(x => x.id === id); (path || []).forEach(i => { n = n && (n.kids || [])[i]; }); return n; };
const exCount = n => (n.kids || []).reduce((a, k) => a + 1 + exCount(k), 0);
const exDots = r => '<span class="dots">' + String(r || "").slice(-8).split("").map(c => `<i class="${c === "o" ? "o" : "x"}"></i>`).join("") + "</span>";
/* ───── 一覧 ───── */
function exHome(){ const subs = [...A2.S.subjects.values()].filter(s => s.cat === V.cat).sort((a, b) => a.name.localeCompare(b.name, "ja"));
  return catTabs() + (subs.map(s => { const d = exDoc(s.id), last = d.hist[0]; return `<button class="mat" data-xsub="${s.id}" style="border-left:5px solid ${s.c};border-radius:0 6px 6px 0"><div class="top"><b>${esc(s.name)}</b><small>${d.mats.length ? "材料 " + d.mats.length : ""}${d.loose.length ? "・ばら " + d.loose.length : ""}${d.map.length ? "・地図 " + d.map.length : ""}</small></div><div class="note">${last ? "最後の演習:" + A2.dayStr(A2.dayOf(last.t)) + " " + esc(last.qn) + ` <span class="gb g-${last.g}">${last.g}</span>` : "まだ演習していない"}</div></button>`; }).join("") || '<p class="note">この分類には、まだ分野がない。暗記の「+ 分野」で作ると、ここにも出る。</p>'); }
function exSubject(){ const s = exSubj(), doc = exDoc(s.id); let body = "";
  if (EXV.tab === "材料") body = (doc.mats.map(m => { const st = exStat(m.items), nx = exNext(m); return `<button class="mat" data-xmat="${m.id}"><div class="top"><b>${esc(m.name)}</b><small>${esc(m.kind || "")}</small></div><div class="bar"><i style="width:${st.all ? st.o / st.all * 100 : 0}%;background:var(--ok)"></i><i style="width:${st.all ? st.t / st.all * 100 : 0}%;background:var(--mid)"></i><i style="width:${st.all ? st.x / st.all * 100 : 0}%;background:var(--shu)"></i></div><div class="legend"><span style="--c:var(--ok)">○ ${st.o}</span><span style="--c:var(--mid)">△ ${st.t}</span><span style="--c:var(--shu)">× ${st.x}</span><span style="--c:var(--rule)">まだ ${st.all - st.o - st.t - st.x}</span>${nx ? `<span style="--c:var(--wave)">次:${esc(nx.n)}</span>` : ""}</div></button>`; }).join("") || '<p class="note">問題集はまだない。</p>') +
    `<button class="madd" data-xmatnew>+ 問題集を足す</button><h2>ばらの問題<small>問題集に入っていない1問ずつ</small></h2><div class="card">${doc.loose.map(q => `<div class="loose"><span class="gb g-${q.s}">${q.s || "まだ"}</span><div class="nm">${esc(q.n)}<small>${esc(q.src || "")}${q.area ? (q.src ? "・" : "") + "地図「" + esc(q.area) + "」" : ""}</small></div><button class="btn ghost sm" data-xq="loose|${q.id}">開く</button></div>`).join("") || '<p class="note" style="margin:0">まだない。</p>'}</div><button class="madd" data-xloosenew>+ 問題を1つ足す</button>`;
  if (EXV.tab === "解法の地図") { const areas = exAreas(doc); if (!EXV.area || !areas.includes(EXV.area)) EXV.area = areas[0];
    const its = doc.map.filter(x => x.area === EXV.area && x.kind === EXV.kind), k = EXK.find(x => x[0] === EXV.kind), allOpen = its.length && its.every(x => EXV.mopen[x.id]);
    body = `<nav class="marea">${areas.map(a => `<button data-xarea="${esc(a)}" aria-pressed="${EXV.area === a}">${esc(a)}<small>${doc.map.filter(x => x.area === a).length}</small></button>`).join("")}<button data-xareanew style="color:var(--wave)">+ 領域</button></nav>
      ${!areas.length ? '<p class="note">まず「+ 領域」で、地図の領域(例:長文読解・英作文)を作る。AIに作ってもらってもよい。</p><button class="btn sm shu" data-xai>AIに作ってもらう</button>' : `<div class="mkind">${EXK.map(([kk, t]) => `<button data-xkind="${kk}" aria-pressed="${EXV.kind === kk}">${t}<small>${doc.map.filter(x => x.area === EXV.area && x.kind === kk).length}</small></button>`).join("")}</div>
      <div class="mdesc"><span>${k[2]}</span>${its.length ? `<button class="linkx" data-xmall="${allOpen ? "close" : "open"}">${allOpen ? "全部たたむ" : "全部ひらく"}</button>` : ""}</div>
      <div class="mapl k-${EXV.kind}">${its.map(exItem).join("") || '<p class="note" style="padding:.6rem 0">まだない。下の「+ 書き足す」から。</p>'}</div>
      <div class="row" style="margin:.6rem 0 0;gap:.6rem"><button class="btn sm shu" data-xai>AIに作ってもらう</button><button class="btn ghost sm" data-xmapcopy>この領域の地図をコピー</button></div>
      ${EXV.adding ? `<div class="maddf"><input id="xadd-h" placeholder="${{ 常に: "見出し(例:時間を見る)", もし: "〜が出たら(例:知らない単語が出たら)", 型: "型の名前(例:要約問題)", 手順: "手順の名前" }[EXV.kind]}"><textarea id="xadd-t" rows="2" placeholder="${{ 常に: "どう意識するか", もし: "こうする", 型: "こう解く", 手順: "ひとことで(段は、あとで「⋯」から足す)" }[EXV.kind]}"></textarea><div class="row"><button class="btn sm" data-xaddsave>書き足す</button><button class="linkx" data-xaddcancel>やめる</button></div></div>` : `<button class="madd" data-xaddopen>+ 書き足す</button>`}`}`; }
  if (EXV.tab === "結果") body = doc.hist.length ? doc.hist.map(h => exHistRow(h, true)).join("") : '<p class="note">まだ演習していない。</p>';
  return `<div class="crumb"><button class="back" data-xhome>‹ 演習</button>${esc((CATS.find(c => c.id === s.cat) || {}).name || "")}</div><div class="shead" style="--c:${s.c}"><h3>${esc(s.name)}</h3><small>演習</small></div>
    <div class="tabs">${[["材料", doc.mats.length + doc.loose.length], ["解法の地図", doc.map.length], ["結果", doc.hist.length]].map(([t, n]) => `<button data-xtab="${t}" aria-selected="${EXV.tab === t}">${t}${n ? `<span>${n}</span>` : ""}</button>`).join("")}</div>${body}`; }
function exHistRow(h, withName){ const ok = Object.values(h.marks || {}).filter(v => v === "o").length, ng = Object.values(h.marks || {}).filter(v => v === "x").length;
  return `<button class="hist g-${h.g}" data-xhist="${h.id}" style="display:block;width:100%;text-align:left;border-top:0;border-right:0;border-bottom:0;background:none"><small>${A2.dayStr(A2.dayOf(h.t))}・${exTm(h.sec)}${ok + ng ? "・意識 できた" + ok + " 忘れた" + ng : ""}</small><span class="gb g-${h.g}">${h.g}</span> ${withName ? esc(h.qn) : ""}${h.note ? `<div class="note">${esc(h.note)}</div>` : ""}</button>`; }
function exMaterial(){ const s = exSubj(), doc = exDoc(s.id), m = exMat(doc, EXV.mat), st = exStat(m.items), nx = exNext(m);
  return `<div class="crumb"><button class="back" data-xbacksub>‹ ${esc(s.name)}</button>演習の材料</div><div class="shead" style="--c:${s.c}"><h3>${esc(m.name)}</h3><small>${esc(m.kind || "")}・全${st.all}${m.area ? "・解法の地図「" + esc(m.area) + "」" : ""}</small></div>
    <div class="legend"><span style="--c:var(--ok)">○ できた ${st.o}</span><span style="--c:var(--mid)">△ あやしい ${st.t}</span><span style="--c:var(--shu)">× できなかった ${st.x}</span><span style="--c:var(--rule)">まだ ${st.all - st.o - st.t - st.x}</span></div>
    <div class="grid">${m.items.map(x => `<button class="q${x.s ? " s-" + x.s : ""}${nx === x ? " next" : ""}" data-xq="${m.id}|${x.id}">${esc(x.n)}</button>`).join("")}</div>
    <div class="row">${nx ? `<button class="btn shu" data-xstart="${m.id}|${nx.id}">次の ${esc(nx.n)} で演習する</button>` : ""}<button class="linkx" data-xmatedit="${m.id}">この問題集を直す</button></div><p class="note">問題の番号を押すと、その問題のこれまでの演習が見られる。</p>`; }
/* ───── 地図の項目(形ごと) ───── */
const exHasDet = it => !!(it.detail || (it.figs || []).length);
function exFigs(it){ return (it.figs || []).length ? `<div class="figs">${it.figs.map(f => f.type === "img" ? `<img src="${f.src}" alt="図">` : `<pre class="mermaid">${esc(f.code)}</pre>`).join("")}</div>` : ""; }
function exDet(it, open){ return exHasDet(it) && open ? `<div class="mdet">${it.detail ? `<p>${esc(it.detail)}</p>` : ""}${exFigs(it)}</div>` : ""; }
function exBar(it){ const n = (it.res || "").length, ok = ((it.res || "").match(/o/g) || []).length; return `<span class="mlv"><i style="width:${n ? Math.round(ok / n * 100) : 0}%"></i></span><span class="mlvt">${n ? ok + "/" + n : "まだ"}</span>`; }
function exKids(kids, root, path){ return (kids || []).length ? `<div class="mkids">${kids.map((k, i) => { const p2 = path.concat(i), key = root.id + ":" + p2.join("."), open = !!EXV.mopen[key];
    return `<div class="mrule sub"><span class="mjoint"></span><div class="mrow"><div class="mcond"><small>この場合</small>${esc(k.h)}</div><div class="marr">→</div><div class="mact">${esc(k.t || "")}${exHasDet(k) ? ` <button class="mdtg" data-xmopen="${key}">${open ? "詳細をとじる" : "詳細"}</button>` : ""}</div></div>${exDet(k, open)}${exKids(k.kids, root, p2)}</div>`; }).join("")}</div>` : ""; }
function exItem(it){ const open = !!EXV.mopen[it.id], tools = `<button class="mmore" data-xmedit="${it.id}" aria-label="直す">⋯</button>`;
  if (it.kind === "常に") return `<article class="mtile${open ? " open" : ""}"><button class="mtb" data-xmopen="${it.id}"${exHasDet(it) ? "" : " disabled"}><b>${esc(it.h)}</b><span>${esc(it.t || "")}</span></button>${exDet(it, open)}<div class="mcf">${exBar(it)}${exHasDet(it) ? `<span class="figb">${open ? "▴" : "詳細"}</span>` : ""}${tools}</div></article>`;
  if (it.kind === "手順") { const sel = EXV.mstep[it.id], ks = it.kids || [];
    return `<article class="mflow"><div class="mfh"><b>${esc(it.h)}</b>${tools}</div>${it.t ? `<p class="mft">${esc(it.t)}</p>` : ""}<div class="mfsteps">${ks.map((k, j) => `${j ? '<span class="mfa">→</span>' : ""}<button class="mfs${sel === j ? " on" : ""}" data-xmstep="${it.id}|${j}"><i>${j + 1}</i>${esc(k.h)}</button>`).join("") || '<span class="note">段はまだない。「⋯」から足す。</span>'}</div>
      ${sel != null && ks[sel] ? `<div class="mfdet"><b>${sel + 1}. ${esc(ks[sel].h)}</b><p>${esc(ks[sel].t || "")}</p>${ks[sel].detail ? `<p class="note">${esc(ks[sel].detail)}</p>` : ""}${exKids(ks[sel].kids, it, [sel])}</div>` : ""}<div class="mcf">${exBar(it)}</div></article>`; }
  return `<article class="mrule"><div class="mrow top"><div class="mcond"><small>${it.kind === "型" ? "この型が出たら" : "もし"}</small>${esc(it.h)}</div><div class="marr">→</div><div class="mact">${esc(it.t || "")}${exHasDet(it) ? ` <button class="mdtg" data-xmopen="${it.id}">${open ? "詳細をとじる" : "詳細"}</button>` : ""}</div></div>${exDet(it, open)}${exKids(it.kids, it, [])}<div class="mcf">${exBar(it)}${(it.kids || []).length ? `<span class="mlvt">場合分け ${exCount(it)}</span>` : ""}${tools}</div></article>`; }
/* ───── 解法の地図を、AIに作ってもらって取り込む(決まった書き方) ─────
   ## 領域 / ### 常に・もし・型・手順 / - 見出し | すること / 字下げ2つで入れ子(手順は段) / > 詳細 / ```mermaid … ``` で図 */
const KIND_ALIAS = { 常に: "常に", 常に意識: "常に", 意識: "常に", もし: "もし", "もし〜なら": "もし", もしなら: "もし", 型: "型", 問題の型: "型", 手順: "手順" };
function mapToText(items){ const by = {}; items.forEach(it => { (by[it.area] = by[it.area] || {})[it.kind] = (by[it.area][it.kind] || []).concat(it); });
  const node = (n, lv) => [" ".repeat(lv * 2) + "- " + n.h + (n.t ? " | " + n.t : "")].concat(n.detail ? [" ".repeat(lv * 2 + 2) + "> " + n.detail.replace(/\n/g, " ")] : [], (n.figs || []).filter(f => f.type === "mermaid").flatMap(f => [" ".repeat(lv * 2 + 2) + "```mermaid"].concat(f.code.split("\n").map(l => " ".repeat(lv * 2 + 2) + l), [" ".repeat(lv * 2 + 2) + "```"])), (n.kids || []).flatMap(k => node(k, lv + 1)));
  return Object.entries(by).map(([a, ks]) => ["## " + a].concat(EXK.filter(([k]) => ks[k]).flatMap(([k]) => ["### " + k].concat(ks[k].flatMap(n => node(n, 0)))))).flat().join("\n"); }
function parseMapText(text, defArea){ const out = []; let area = defArea || "全体", kind = "常に", stack = [], fig = null, figInd = 0;
  String(text || "").replace(/\r/g, "").split("\n").forEach(raw => { const line = raw.replace(/\t/g, "  ");
    if (fig) { if (/^\s*```\s*$/.test(line)) { if (fig.node) (fig.node.figs = fig.node.figs || []).push({ type: "mermaid", code: fig.lines.join("\n") }); fig = null; } else fig.lines.push(line.slice(Math.min(figInd, line.length - line.trimStart().length))); return; }
    const t = line.trim(); if (!t) return; let m;
    const owner = ind0 => { for (let i = stack.length - 1; i >= 0; i--) if (stack[i].ind * 2 + 2 <= ind0) return stack[i].n; return stack.length ? stack[0].n : null; };   // 字下げがそろう項目のもの
    if (/^```mermaid/i.test(t)) { figInd = line.length - line.trimStart().length; fig = { node: owner(figInd), lines: [] }; return; }
    if (/^```/.test(t)) return;
    if ((m = /^##\s+(.+)$/.exec(t)) && !/^###/.test(t)) { area = m[1].trim(); stack = []; return; }
    if ((m = /^###\s+(.+)$/.exec(t))) { kind = KIND_ALIAS[m[1].trim().replace(/\s/g, "")] || "常に"; stack = []; return; }
    if ((m = /^>\s?(.*)$/.exec(t))) { const n = owner(line.length - line.trimStart().length); if (n) n.detail = (n.detail ? n.detail + " " : "") + m[1].trim(); return; }
    if ((m = /^[-*・]\s+(.+)$/.exec(t))) { const ind = Math.floor((line.length - line.trimStart().length) / 2), parts = m[1].split(/\s*[|｜]\s*/), n = { h: parts[0].trim(), t: parts.slice(1).join(" | ").trim(), kids: [] };
      while (stack.length && stack[stack.length - 1].ind >= ind) stack.pop();
      if (stack.length) stack[stack.length - 1].n.kids.push(n); else out.push(Object.assign(n, { area, kind })); stack.push({ ind, n }); } });
  return out; }
const nrm = s => String(s || "").replace(/\s+/g, "").toLowerCase();
function planMerge(doc, items){ let add = 0, merge = 0, kidsAdded = 0; const addKids = (dst, src, apply) => (src || []).forEach(k => { const e = (dst.kids || []).find(x => nrm(x.h) === nrm(k.h)); if (e) { if (apply) { if (!e.t && k.t) e.t = k.t; if (!e.detail && k.detail) e.detail = k.detail; } addKids(e, k.kids, apply); } else { kidsAdded++; if (apply) (dst.kids = dst.kids || []).push(Object.assign({ id: "k" + A2.uid() }, k, { kids: [] })), addKids(dst.kids[dst.kids.length - 1], k.kids, apply); } });
  const apply = items.apply; items.list.forEach(it => { const e = doc.map.find(x => x.area === it.area && x.kind === it.kind && nrm(x.h) === nrm(it.h));
    if (e) { merge++; if (apply) { if (!e.t && it.t) e.t = it.t; if (!e.detail && it.detail) e.detail = it.detail; if (it.figs) e.figs = (e.figs || []).concat(it.figs.filter(f => !(e.figs || []).some(g => g.code === f.code))); } addKids(e, it.kids, apply); }
    else { add++; if (apply) { const n = Object.assign({ id: "m" + A2.uid(), res: "" }, it, { kids: [] }); doc.map.push(n); addKids(n, it.kids, true); } } });
  return { add, merge, kidsAdded }; }
function mapPrompt(doc, area, req, withNow){ const now = doc.map.filter(x => !area || x.area === area);
  return ["あなたは、受験生の「解法の地図」を作る担当です。解法の地図は、問題を解くときに意識すること・出会ったときにすること・問題の型ごとの解き方・手順を、あとで演習のときに見ながら使えるように整理したものです。", "",
    "# 作ってほしいもの", (area ? "領域「" + area + "」について。" : "") + (req || "(ここに何をもとに作るかを書く)"), "",
    "# 書き方(この形だけで、1つのコードブロックにして出す。前置きや説明は書かない)", "```", "## 領域の名前", "### 常に", "- 見出し | どう意識するか", "  > 詳細(長い説明。なくてよい)", "### もし", "- 〜が出たら | こうする", "  - この場合(〜なら) | こうする", "    - さらにこの場合 | こうする", "### 型", "- 問題の型の名前 | こう解く", "  - ただし〜のとき | こうする", "### 手順", "- 手順の名前 | ひとことで", "  - 1つ目の段 | すること", "  - 2つ目の段 | すること", "```", "",
    "# 決まり", "- 「常に」は読んでいるあいだずっと意識すること、「もし」は何かに出会ったときにすること、「型」は問題の型ごとの解き方、「手順」は順番に進めること", "- 入れ子は、行の頭の空白2つで1段。「もし」と「型」の入れ子は場合分け、「手順」の入れ子は段(左から順)", "- 見出しは短く(20字くらいまで)。すること は具体的に、その場でできる動きで書く", "- 図があると分かりやすいときだけ、項目の下に ```mermaid のコードブロックで矢印の図を入れる(字下げをそろえる)", "- 「|」と「>」は書き方の印なので、中身には使わない",
    withNow && now.length ? "\n# 今の地図(これと同じことは書かない。足すことだけ書く。同じ見出しに場合分けを足すときは、同じ見出しで書いてよい)\n```\n" + mapToText(now) + "\n```" : ""].join("\n"); }
/* ───── 演習(画面いっぱい) ───── */
let exTimer = null;
function exStart(mid, qid){ EXV.run = { mat: mid, q: qid, sec: 0, go: true, mark: {}, done: false, grade: "", note: "", pane: null }; V.sheet = null; se("add");
  try { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); } catch (e) {} wakeOn();
  clearInterval(exTimer); exTimer = setInterval(() => { const r = EXV.run; if (!r || !r.go || r.done) return; r.sec++; const el = document.querySelector(".exbar .timer"); if (el) el.textContent = String(Math.floor(r.sec / 60)).padStart(2, "0") + ":" + String(r.sec % 60).padStart(2, "0"); }, 1000); go({}); }
function exEnd(){ clearInterval(exTimer); wakeOff(); try { document.fullscreenElement && document.exitFullscreen(); } catch (e) {} EXV.run = null; go({}); }
function exRun(){ const s = exSubj(), doc = exDoc(s.id), r = EXV.run, m = exMat(doc, r.mat), q = m.items.find(x => x.id === r.q), area = q.area || m.area, items = doc.map.filter(x => x.area === area);
  const mm = String(Math.floor(r.sec / 60)).padStart(2, "0") + ":" + String(r.sec % 60).padStart(2, "0"), qn = (m.id === "loose" ? "" : m.name.slice(0, 14) + " ") + q.n, has = q.body || q.qs, pane = r.pane || (has ? "問題" : "地図");
  const prob = has ? `<div class="exprob">${q.body ? `<div class="exbody">${q.body}</div>` : ""}${q.qs ? `<div class="exqs">${q.qs}</div>` : ""}${(r.done && (q.ans || q.expl)) ? `<div class="exansw">${q.ans ? `<b>解答</b><div>${q.ans}</div>` : ""}${q.expl ? `<b>解説</b><div>${q.expl}</div>` : ""}</div>` : ""}</div>` : `<div class="exprob note">この問題は、本文を入れていない問題(番号だけ)。手元の問題集で解く。</div>`;
  const subl = kids => (kids || []).length ? `<ul class="exkids">${kids.map(k => `<li><b>${esc(k.h)}</b>${k.t ? " → " + esc(k.t) : ""}${subl(k.kids)}</li>`).join("")}</ul>` : "";
  const mapH = EXK.map(([k, t]) => { const its = items.filter(it => it.kind === k); return its.length ? `<h2>${t}</h2><div class="card">${its.map(it => `<div class="chk"><div class="t">${it.kind === "型" ? "<small>この型が出たら</small>" : it.kind === "もし" ? "<small>もし</small>" : ""}<b>${esc(it.h)}</b>${it.t ? `<span class="exact">${it.kind === "常に" ? "" : "→ "}${esc(it.t)}</span>` : ""}${it.kind === "手順" ? `<div class="exsteps">${(it.kids || []).map((x, j) => `<span>${j + 1}. ${esc(x.h)}</span>`).join("<i>→</i>")}</div>` : subl(it.kids)}</div><div class="seg3"><button class="o" data-xmk="${it.id}|o" aria-pressed="${r.mark[it.id] === "o"}">できた</button><button class="x" data-xmk="${it.id}|x" aria-pressed="${r.mark[it.id] === "x"}">忘れた</button><button class="n" data-xmk="${it.id}|n" aria-pressed="${r.mark[it.id] === "n"}">出ず</button></div></div>`).join("")}</div>` : ""; }).join("") || '<p class="note">この問題につないだ解法の地図はない。</p>';
  const past = doc.hist.filter(h => h.mat === r.mat && h.q === r.q);
  const head = `<div class="exbar"><button class="back" data-xbackrun>‹ やめる</button><b>${esc(qn)}</b><span class="timer">${mm}</span>${r.done ? "" : `<button class="btn ghost sm" data-xpause>${r.go ? "止める" : "再開"}</button>`}</div>`;
  if (r.done) return `<div class="exfull">${head}<div class="exscroll"><div class="result"><b>${esc(qn)} を終えた</b><div class="note">${mm}</div></div>${has ? `<h2>解答・解説</h2>${prob}` : ""}
      <h2>出来は?</h2><div class="row">${["○", "△", "×"].map(k => `<button class="btn ${r.grade === k ? "" : "ghost"} sm" data-xgrade="${k}">${k} ${k === "○" ? "できた" : k === "△" ? "あやしい" : "できなかった"}</button>`).join("")}</div>
      <h2>気づいたこと<small>結果に残る。地図にも書き足せる</small></h2><div class="card"><textarea id="xfb" rows="2" style="width:100%">${esc(r.note || "")}</textarea><div class="row" style="margin-top:.3rem"><select id="xfbk">${EXK.map(([k, t]) => `<option value="${k}">${t}</option>`).join("")}</select><button class="btn ghost sm" data-xfbadd>地図に書き足す</button></div></div>
      <div class="row" style="margin:.8rem 0 1.5rem"><button class="btn" data-xfinish${r.grade ? "" : " disabled"}>記録して終える</button></div></div></div>`;
  return `<div class="exfull">${head}${past.length ? `<div class="note" style="padding:.3rem .9rem;background:var(--sheet)">前回 ${A2.dayStr(A2.dayOf(past[0].t))} ${past[0].g}${past[0].note ? "・" + esc(past[0].note) : ""}</div>` : ""}<div class="expanes"><div class="exseg">${["問題", "地図"].map(k => `<button data-xpane="${k}" aria-pressed="${pane === k}">${k === "問題" ? "問題" : "意識すること"}</button>`).join("")}</div>
    <div class="expane p-問題${pane === "問題" ? " on" : ""}">${prob}</div><div class="expane p-地図${pane === "地図" ? " on" : ""}">${mapH}</div></div><div class="exfoot"><button class="btn" data-xend>解き終わった</button></div></div>`; }
function exView(){ if (!EXV.sub || !A2.S.subjects.get(EXV.sub)) { EXV.sub = null; return exHome(); } if (EXV.run) return exRun(); if (EXV.mat) return exMaterial(); return exSubject(); }
/* ───── 下から出る画面(演習) ───── */
const inp = (id, v, ph) => `<input id="${id}" value="${esc(v || "")}" placeholder="${esc(ph || "")}" style="width:100%;padding:.4rem .5rem;border:1px solid var(--rule);border-radius:3px">`;
function exSheet(sh){ if (!sh || !/^x-/.test(sh.k)) return null; const s = exSubj(), doc = s ? exDoc(s.id) : null, areas = doc ? exAreas(doc) : [];
  const areaSel = (id, v) => `<select id="${id}"><option value="">(なし)</option>${areas.map(a => `<option${a === v ? " selected" : ""}>${esc(a)}</option>`).join("")}</select>`;
  if (sh.k === "x-mat") { const m = sh.id ? doc.mats.find(x => x.id === sh.id) : null;
    return `<h3>${m ? "問題集を直す" : "問題集を足す"}</h3><div class="f"><label>名前</label>${inp("xm-n", m && m.name, "例:青チャート IA 例題")}</div><div class="f"><label>種類(なくてよい)</label>${inp("xm-k", m && m.kind, "例:問題集・過去問・長文")}</div>
      <div class="f"><label>見ながら解く解法の地図</label>${areaSel("xm-a", m && m.area)}</div>
      ${m ? `<div class="f"><label>問題を足す(番号を空白で区切る。例:121 122 または 121-130)</label>${inp("xm-add", "", "")}</div>` : `<div class="f"><label>問題の番号</label>${inp("xm-r", "", "例:1-120(連番)、2015-2024、または 1 2 3 5 のように並べる")}</div>`}
      <div class="row"><button class="btn" data-xmatsave="${m ? m.id : ""}">${m ? "直す" : "足す"}</button>${m ? '<button class="linkx" data-xmatdel style="color:var(--shu);margin-left:auto">この問題集を消す</button>' : ""}</div>`; }
  if (sh.k === "x-loose") { const q = sh.id ? doc.loose.find(x => x.id === sh.id) : {}; const ta = (id, v, ph, rows) => `<textarea id="${id}" rows="${rows || 3}" placeholder="${ph}" style="width:100%">${esc(v || "")}</textarea>`;
    return `<h3>${sh.id ? "問題を直す" : "問題を1つ足す"}</h3><div class="f"><label>問題の名前</label>${inp("xl-n", q.n, "例:全統記述模試 大問3")}</div><div class="f"><label>出どころ(なくてよい)</label>${inp("xl-s", q.src, "例:模試・10月")}</div><div class="f"><label>見ながら解く解法の地図</label>${areaSel("xl-a", q.area)}</div>
      <details class="morefld"${q.body ? " open" : ""}><summary>本文・設問・解答も入れる(なくてよい。入れると演習の画面に出る)</summary><div class="f"><label>本文</label>${ta("xl-b", q.body, "", 5)}</div><div class="f"><label>設問</label>${ta("xl-q", q.qs, "")}</div><div class="f"><label>解答</label>${ta("xl-ans", q.ans, "")}</div><div class="f"><label>解説</label>${ta("xl-e", q.expl, "")}</div></details>
      <div class="row" style="margin-top:.5rem"><button class="btn" data-xloosesave="${sh.id || ""}">${sh.id ? "直す" : "足す"}</button>${sh.id ? "" : '<button class="btn ghost" data-xloosesave="" data-go="1">足してすぐ演習する</button>'}${sh.id ? '<button class="linkx" data-xloosedel style="color:var(--shu);margin-left:auto">消す</button>' : ""}</div>`; }
  if (sh.k === "x-q") { const m = exMat(doc, sh.mat), q = m.items.find(x => x.id === sh.q), hs = doc.hist.filter(h => h.mat === sh.mat && h.q === sh.q);
    return `<h3>${esc(m.id === "loose" ? q.n : m.name + " " + q.n)}</h3><div class="note">今の印:<span class="gb g-${q.s || ""}">${q.s || "まだ"}</span>・演習 ${hs.length}回</div><h2>これまでの演習</h2>${hs.map(h => exHistRow(h, false)).join("") || '<p class="note">まだない。</p>'}
      <div class="row" style="margin-top:.6rem"><button class="btn shu" data-xstart="${sh.mat}|${sh.q}">この問題で演習する</button>${m.id === "loose" ? `<button class="linkx" data-xlooseedit="${q.id}">直す</button>` : ""}</div>`; }
  if (sh.k === "x-h") { const h = doc.hist.find(x => x.id === sh.id), items = doc.map.filter(it => (h.marks || {})[it.id]);
    return `<h3>${esc(h.qn)}</h3><div class="note">${A2.dayStr(A2.dayOf(h.t))}・${exTm(h.sec)}・<span class="gb g-${h.g}">${h.g}</span></div>${h.note ? `<div class="pkv"><span class="k">気づいたこと</span><span class="v">${esc(h.note)}</span></div>` : ""}
      ${items.length ? `<h2>意識できたか</h2><div class="card">${items.map(it => `<div class="chk"><div class="t"><b>${esc(it.h)}</b></div><span class="gb g-${h.marks[it.id] === "o" ? "○" : h.marks[it.id] === "x" ? "×" : ""}">${h.marks[it.id] === "o" ? "できた" : h.marks[it.id] === "x" ? "忘れた" : "出ず"}</span></div>`).join("")}</div>` : ""}<div class="row"><button class="linkx" data-xhistdel="${h.id}" style="color:var(--shu)">この記録を消す</button></div>`; }
  if (sh.k === "x-ai") { const its = sh.text ? parseMapText(sh.text, sh.area || EXV.area) : [], plan = its.length ? planMerge(doc, { list: its, apply: false }) : null;
    return `<h3>AIに解法の地図を作ってもらう</h3><p class="note" style="margin-top:0">1. 何をもとに作るかを書いて、指示文をコピーする → 2. Claude に貼る → 3. 返ってきたものを下に貼って取り込む。</p>
      <div class="f"><label>領域(新しい名前でもよい)</label><input id="xai-a" list="xai-al" value="${esc(sh.area != null ? sh.area : (EXV.area || ""))}" placeholder="例:長文読解" style="width:100%;padding:.4rem .5rem;border:1px solid var(--rule);border-radius:3px"><datalist id="xai-al">${areas.map(a => `<option value="${esc(a)}">`).join("")}</datalist></div>
      <div class="f"><label>何をもとに作るか(資料を貼ってもよい)</label><textarea id="xai-r" rows="4" style="width:100%" placeholder="例:東大の英語の長文読解の設問の解き方。いつも時間が足りなくなる">${esc(sh.req || "")}</textarea></div>
      <label class="chk" style="border:0"><input type="checkbox" id="xai-now"${sh.now === false ? "" : " checked"}> 今の地図も一緒に渡す(同じことを重ねずに、足してもらう)</label>
      <div class="row"><button class="btn shu" data-xaicopy>指示文をコピー</button></div>
      <h2>取り込む<small>返ってきたものを、そのまま貼る</small></h2><textarea id="xai-t" rows="7" style="width:100%;font-family:ui-monospace,monospace;font-size:.78rem" placeholder="## 長文読解&#10;### もし&#10;- 知らない単語が出たら | …">${esc(sh.text || "")}</textarea>
      ${sh.text ? (its.length ? `<div class="aiim"><div class="note">${[...new Set(its.map(x => x.area))].map(esc).join("・")}:新しい項目 <b>${plan.add}</b>・今ある項目に足す ${plan.merge}・場合分けや段 <b>${plan.kidsAdded}</b></div><div class="aiil">${its.slice(0, 40).map(x => `<div class="aiir"><b>${esc(x.h)}</b><span>${esc(x.area)} › ${{ 常に: "常に", もし: "もし〜なら", 型: "問題の型", 手順: "手順" }[x.kind]}${x.kids.length ? "・中に " + x.kids.length : ""}</span></div>`).join("")}</div><div class="row" style="margin-top:.4rem"><button class="btn" data-xaiimport>取り込む</button></div></div>` : '<div class="mkneed" style="margin-top:.3rem">読み取れる項目がない。「## 領域」「### 形」「- 見出し | すること」の形か確かめる。</div>') : ""}`; }
  if (sh.k === "x-area") return `<h3>領域を足す</h3><div class="f"><label>名前</label>${inp("xa-n", "", "例:長文読解・英作文・評論")}</div><button class="btn" data-xareasave>足す</button>`;
  if (sh.k === "x-medit") { const path = sh.path || [], it = exNode(doc, sh.id, path), root = exNode(doc, sh.id, []), lvl = path.length;
    const lab = lvl ? ["この場合(〜なら)", "こうする"] : ({ 常に: ["見出し", "どう意識するか"], もし: ["〜が出たら", "こうする"], 型: ["型の名前", "こう解く"], 手順: ["手順の名前", "ひとことで"] })[root.kind];
    const crumbs = [root.h].concat(path.map((x, k) => exNode(doc, sh.id, path.slice(0, k + 1)).h));
    return `<h3>${lvl ? "場合分けを直す" : "項目を直す"}</h3>${lvl ? `<div class="mcrumb">${crumbs.map((c, k) => `<button class="linkx" data-xmpath="${k}">${esc(c)}</button>`).join(" › ")}</div>` : ""}
      <div class="f"><label>${lab[0]}</label>${inp("xe-h", it.h)}</div><div class="f"><label>${lab[1]}</label><textarea id="xe-t" rows="2" style="width:100%">${esc(it.t || "")}</textarea></div><div class="f"><label>詳細(長い説明。押すと開く)</label><textarea id="xe-d" rows="3" style="width:100%">${esc(it.detail || "")}</textarea></div>
      <h2>${root.kind === "手順" && !lvl ? "段" : "場合分け"}<small>${root.kind === "手順" && !lvl ? "左から順に並ぶ" : "この中で、さらにこういう場合はこうする"}</small></h2>
      <div class="mkedit">${(it.kids || []).map((k, i) => `<div class="mkrow"><span class="note" style="width:1.4rem">${i + 1}</span><div class="nm"><b>${esc(k.h)}</b><small>${esc(k.t || "")}${(k.kids || []).length ? "・場合分け " + exCount(k) : ""}</small></div><button class="mvb" data-xkup="${i}">▲</button><button class="mvb" data-xkdn="${i}">▼</button><button class="btn ghost sm" data-xkgo="${i}">開く</button><button class="mvb rm" data-xkrm="${i}">×</button></div>`).join("") || '<p class="note" style="margin:.2rem 0">まだない。</p>'}
        <div class="mkadd"><input id="xk-h" placeholder="${root.kind === "手順" && !lvl ? "段の名前" : "この場合(例:何度も出てくるなら)"}"><input id="xk-t" placeholder="こうする"><button class="btn sm" data-xkadd>足す</button></div></div>
      <h2>図<small>${(it.figs || []).length}つ</small></h2>${(it.figs || []).map((f, i) => `<div class="card">${f.type === "img" ? `<img src="${f.src}" alt="図" style="max-width:100%">` : `<pre class="mermaid">${esc(f.code)}</pre>`}<button class="linkx" data-xfigrm="${i}" style="color:var(--shu)">この図を外す</button></div>`).join("")}
      <div class="row"><label class="btn ghost sm" style="cursor:pointer">画像を選ぶ<input type="file" id="xfig-file" accept="image/*" hidden></label><span class="note">貼りつけ(Ctrl+V)でも入る</span></div>
      <div class="f" style="margin-top:.5rem"><label>文字で書く図</label><textarea id="xfig-mm" rows="3" style="width:100%;font-family:ui-monospace,monospace;font-size:.78rem" placeholder="graph LR&#10;  A[主張] --> B[例]"></textarea><button class="btn ghost sm" data-xfigmm>この図を足す</button></div>
      <div class="row" style="margin-top:.6rem"><button class="btn" data-xmesave>直す</button>${lvl ? '<button class="btn ghost sm" data-xmpath="-1">‹ ひとつ上へ</button>' : ""}<button class="linkx" data-xmerm style="color:var(--shu);margin-left:auto">${lvl ? "この場合分けを消す" : "この項目を消す"}</button></div>`; }
  return ""; }
/* ───── 図(Mermaid):必要になったら読み込む ───── */
let mmLoading = false, mmInit = false;
function exDrawMermaid(){ const nodes = [...document.querySelectorAll("pre.mermaid:not([data-processed])")]; if (!nodes.length) return;
  if (!window.mermaid) { if (!mmLoading) { mmLoading = true; const sc = document.createElement("script"); sc.src = "https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"; sc.onload = exDrawMermaid; document.head.appendChild(sc); } return; }
  if (!mmInit) { mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "neutral" }); mmInit = true; }
  mermaid.run({ nodes }).catch(() => {}); }
async function exShrink(file){ const bmp = await createImageBitmap(file), k = Math.min(1, 900 / Math.max(bmp.width, bmp.height)), c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height); return c.toDataURL("image/jpeg", .82); }
async function exAddFig(file){ const sh = V.sheet; if (!sh || sh.k !== "x-medit" || !file) return; const doc = exDoc(EXV.sub), it = exNode(doc, sh.id, sh.path || []); exKeep(); (it.figs = it.figs || []).push({ type: "img", src: await exShrink(file) }); await exSave(doc); toast("図を付けた"); render(); }
function exKeep(){ const sh = V.sheet; if (!sh || sh.k !== "x-medit" || !$("xe-h")) return; const it = exNode(exDoc(EXV.sub), sh.id, sh.path || []); it.h = $("xe-h").value.trim() || it.h; it.t = $("xe-t").value.trim(); it.detail = $("xe-d").value.trim(); }
const parseNums = str => { const out = []; String(str || "").split(/[\s,、]+/).filter(Boolean).forEach(t => { const m = /^(\d+)\s*[-〜~]\s*(\d+)$/.exec(t); if (m && +m[2] >= +m[1] && +m[2] - +m[1] < 2000) for (let i = +m[1]; i <= +m[2]; i++) out.push(String(i)); else out.push(t); }); return out; };
/* ───── 押したとき(演習) ───── */
document.addEventListener("click", async e => { const b = e.target.closest("button"); if (!b || b.disabled) return; const d = b.dataset; const doc = EXV.sub ? exDoc(EXV.sub) : null;
  if (d.xsub) { EXV = Object.assign(EXV, { sub: d.xsub, tab: "材料", area: null, kind: "常に", mat: null, adding: false }); go({}); return; }
  if (b.hasAttribute("data-xhome")) { EXV.sub = null; go({}); return; }
  if (d.xtab) { EXV.tab = d.xtab; EXV.adding = false; render(); return; } if (d.xarea) { EXV.area = d.xarea; render(); return; } if (d.xkind) { EXV.kind = d.xkind; EXV.adding = false; render(); return; }
  if (b.hasAttribute("data-xai")) { V.sheet = { k: "x-ai", area: EXV.area || "" }; render(); return; }
  if (b.hasAttribute("data-xaicopy")) { const sh = V.sheet; sh.area = $("xai-a").value.trim(); sh.req = $("xai-r").value.trim(); sh.now = $("xai-now").checked; const t = mapPrompt(doc, sh.area, sh.req, sh.now);
    const ok = () => { se("add"); toast("指示文をコピーした。Claude に貼る"); render(); }; if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, () => prompt("コピーしてください", t)); else prompt("コピーしてください", t); return; }
  if (b.hasAttribute("data-xaiimport")) { const sh = V.sheet, its = parseMapText(sh.text, sh.area || EXV.area); if (!its.length) return; const r = planMerge(doc, { list: its, apply: true }); its.forEach(x => { if (!exAreas(doc).includes(x.area)) doc.areas = [...new Set((doc.areas || []).concat(x.area))]; });
    await exSave(doc); EXV.area = its[0].area; EXV.kind = its[0].kind; EXV.tab = "解法の地図"; V.sheet = null; se("done"); toast("取り込んだ:新しい項目 " + r.add + "・場合分けや段 " + r.kidsAdded); render(); return; }
  if (b.hasAttribute("data-xmapcopy")) { const t = mapToText(doc.map.filter(x => x.area === EXV.area)); if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(() => { toast("この領域の地図をコピーした"); render(); }, () => prompt("コピーしてください", t)); else prompt("コピーしてください", t); return; }
  if (b.hasAttribute("data-xareanew")) { V.sheet = { k: "x-area" }; render(); return; }
  if (b.hasAttribute("data-xareasave")) { const n = $("xa-n").value.trim(); if (!n) return; doc.areas = [...new Set((doc.areas || []).concat(n))]; await exSave(doc); EXV.area = n; V.sheet = null; render(); return; }
  if (d.xmopen) { EXV.mopen[d.xmopen] = !EXV.mopen[d.xmopen]; render(); return; }
  if (d.xmall) { doc.map.filter(x => x.area === EXV.area && x.kind === EXV.kind).forEach(x => EXV.mopen[x.id] = d.xmall === "open"); render(); return; }
  if (d.xmstep) { const [id, j] = d.xmstep.split("|"); EXV.mstep[id] = EXV.mstep[id] === +j ? null : +j; render(); return; }
  if (b.hasAttribute("data-xaddopen")) { EXV.adding = true; render(); setTimeout(() => { const el = $("xadd-h"); if (el) el.focus(); }, 50); return; }
  if (b.hasAttribute("data-xaddcancel")) { EXV.adding = false; render(); return; }
  if (b.hasAttribute("data-xaddsave")) { const h = $("xadd-h").value.trim(), t = $("xadd-t").value.trim(); if (!h && !t) return; doc.map.push({ id: "m" + A2.uid(), area: EXV.area, kind: EXV.kind, h: h || t.slice(0, 30), t: h ? t : "", kids: [], res: "" }); EXV.adding = false; await exSave(doc); se("add"); render(); return; }
  if (d.xmedit) { V.sheet = { k: "x-medit", id: d.xmedit, path: [] }; render(); return; }
  const cur = () => exNode(doc, V.sheet.id, V.sheet.path || []);
  if (d.xkgo != null && b.hasAttribute("data-xkgo")) { exKeep(); V.sheet.path = (V.sheet.path || []).concat(+d.xkgo); await exSave(doc); render(); return; }
  if (d.xmpath != null && b.hasAttribute("data-xmpath")) { exKeep(); const k = +d.xmpath, p0 = V.sheet.path || []; V.sheet.path = k < 0 ? p0.slice(0, -1) : p0.slice(0, k); await exSave(doc); render(); return; }
  if (b.hasAttribute("data-xkadd")) { exKeep(); const h = $("xk-h").value.trim(), t = $("xk-t").value.trim(); if (!h) { $("xk-h").focus(); return; } const it = cur(); (it.kids = it.kids || []).push({ id: "k" + A2.uid(), h, t }); await exSave(doc); se("add"); render(); setTimeout(() => { const el = $("xk-h"); if (el) el.focus(); }, 50); return; }
  if (d.xkrm != null && b.hasAttribute("data-xkrm")) { exKeep(); cur().kids.splice(+d.xkrm, 1); await exSave(doc); render(); return; }
  if (d.xkup != null && b.hasAttribute("data-xkup")) { exKeep(); const a = cur().kids, k = +d.xkup; if (k > 0) [a[k - 1], a[k]] = [a[k], a[k - 1]]; await exSave(doc); render(); return; }
  if (d.xkdn != null && b.hasAttribute("data-xkdn")) { exKeep(); const a = cur().kids, k = +d.xkdn; if (k < a.length - 1) [a[k + 1], a[k]] = [a[k], a[k + 1]]; await exSave(doc); render(); return; }
  if (d.xfigrm != null && b.hasAttribute("data-xfigrm")) { exKeep(); cur().figs.splice(+d.xfigrm, 1); await exSave(doc); render(); return; }
  if (b.hasAttribute("data-xfigmm")) { const code = $("xfig-mm").value.trim(); if (!code) return; exKeep(); const it = cur(); (it.figs = it.figs || []).push({ type: "mermaid", code }); await exSave(doc); render(); return; }
  if (b.hasAttribute("data-xmesave")) { exKeep(); await exSave(doc); V.sheet = null; toast("直した"); render(); return; }
  if (b.hasAttribute("data-xmerm")) { const p0 = V.sheet.path || []; if (!confirm(p0.length ? "この場合分けを消す?(中の場合分けも消える)" : "この項目を消す?")) return;
    if (p0.length) { exNode(doc, V.sheet.id, p0.slice(0, -1)).kids.splice(p0[p0.length - 1], 1); V.sheet.path = p0.slice(0, -1); } else { doc.map = doc.map.filter(x => x.id !== V.sheet.id); V.sheet = null; } await exSave(doc); render(); return; }
  /* 材料 */
  if (b.hasAttribute("data-xmatnew")) { V.sheet = { k: "x-mat" }; render(); return; }
  if (d.xmatedit) { V.sheet = { k: "x-mat", id: d.xmatedit }; render(); return; }
  if (d.xmatsave != null && b.hasAttribute("data-xmatsave")) { const n = $("xm-n").value.trim(); if (!n) { $("xm-n").focus(); return; } let m = doc.mats.find(x => x.id === d.xmatsave);
    if (!m) { const nums = parseNums($("xm-r").value); if (!nums.length) { toast("問題の番号を入れてください"); render(); return; } m = { id: "M" + A2.uid(), items: nums.map(x => ({ id: "q" + A2.uid() + x, n: x, s: "" })) }; doc.mats.push(m); }
    else parseNums(($("xm-add") || {}).value).forEach(x => { if (!m.items.some(y => y.n === x)) m.items.push({ id: "q" + A2.uid() + x, n: x, s: "" }); });
    Object.assign(m, { name: n, kind: $("xm-k").value.trim(), area: $("xm-a").value }); await exSave(doc); V.sheet = null; se("add"); render(); return; }
  if (b.hasAttribute("data-xmatdel")) { if (!confirm("この問題集を消す?(結果の記録は残る)")) return; doc.mats = doc.mats.filter(x => x.id !== V.sheet.id); await exSave(doc); V.sheet = null; EXV.mat = null; render(); return; }
  if (d.xmat) { EXV.mat = d.xmat; go({}); return; } if (b.hasAttribute("data-xbacksub")) { EXV.mat = null; go({}); return; }
  if (b.hasAttribute("data-xloosenew")) { V.sheet = { k: "x-loose" }; render(); return; }
  if (d.xlooseedit) { V.sheet = { k: "x-loose", id: d.xlooseedit }; render(); return; }
  if (d.xloosesave != null && b.hasAttribute("data-xloosesave")) { const n = $("xl-n").value.trim(); if (!n) { $("xl-n").focus(); return; } let q = doc.loose.find(x => x.id === d.xloosesave); if (!q) { q = { id: "L" + A2.uid(), s: "" }; doc.loose.push(q); }
    Object.assign(q, { n, src: $("xl-s").value.trim(), area: $("xl-a").value, body: $("xl-b").value.trim(), qs: $("xl-q").value.trim(), ans: $("xl-ans").value.trim(), expl: $("xl-e").value.trim() }); await exSave(doc); se("add");
    if (d.go) { exStart("loose", q.id); return; } V.sheet = null; render(); return; }
  if (b.hasAttribute("data-xloosedel")) { if (!confirm("この問題を消す?")) return; doc.loose = doc.loose.filter(x => x.id !== V.sheet.id); await exSave(doc); V.sheet = null; render(); return; }
  if (d.xq) { const [mid, qid] = d.xq.split("|"); V.sheet = { k: "x-q", mat: mid, q: qid }; render(); return; }
  if (d.xhist) { V.sheet = { k: "x-h", id: d.xhist }; render(); return; }
  if (d.xhistdel) { if (!confirm("この記録を消す?")) return; doc.hist = doc.hist.filter(h => h.id !== d.xhistdel); await exSave(doc); V.sheet = null; render(); return; }
  if (d.xstart) { const [mid, qid] = d.xstart.split("|"); exStart(mid, qid); return; }
  /* 演習中 */
  if (b.hasAttribute("data-xbackrun")) { if (EXV.run && !EXV.run.done && EXV.run.sec > 30 && !confirm("記録せずにやめる?")) return; exEnd(); return; }
  if (b.hasAttribute("data-xpause")) { EXV.run.go = !EXV.run.go; render(); return; }
  if (d.xpane) { EXV.run.pane = d.xpane; render(); return; }
  if (d.xmk) { const [id, v] = d.xmk.split("|"); EXV.run.mark[id] = EXV.run.mark[id] === v ? undefined : v; se("tick"); render(); return; }
  if (b.hasAttribute("data-xend")) { EXV.run.done = true; V.top = true; se("done"); render(); return; }
  if (d.xgrade) { EXV.run.note = ($("xfb") || {}).value || EXV.run.note; EXV.run.grade = d.xgrade; render(); return; }
  if (b.hasAttribute("data-xfbadd")) { const t = $("xfb").value.trim(); if (!t) return; const r = EXV.run, m = exMat(doc, r.mat), q = m.items.find(x => x.id === r.q); r.note = t;
    doc.map.push({ id: "m" + A2.uid(), area: q.area || m.area || exAreas(doc)[0] || "全体", kind: $("xfbk").value, h: t.slice(0, 30), t: t.length > 30 ? t : "", kids: [], res: "" }); await exSave(doc); se("add"); toast("地図に書き足した(次の演習から出る)"); render(); return; }
  if (b.hasAttribute("data-xfinish")) { const r = EXV.run; r.note = ($("xfb") || {}).value || r.note; const m = exMat(doc, r.mat), q = m.items.find(x => x.id === r.q); q.s = r.grade;
    doc.map.forEach(it => { const v = r.mark[it.id]; if (v === "o" || v === "x") it.res = (it.res || "") + v; });
    doc.hist.unshift({ id: "h" + A2.uid(), mat: r.mat, q: r.q, qn: (m.id === "loose" ? "" : m.name.slice(0, 14) + " ") + q.n, t: Date.now(), sec: r.sec, g: r.grade, marks: Object.fromEntries(Object.entries(r.mark).filter(([, v]) => v)), note: r.note });
    await exSave(doc); toast("記録した"); exEnd(); return; }
});
document.addEventListener("change", e => { if (e.target.id === "xfig-file" && e.target.files[0]) exAddFig(e.target.files[0]); });
document.addEventListener("input", e => { const t = e.target; if (!V.sheet || V.sheet.k !== "x-ai") return; if (t.id === "xai-a") V.sheet.area = t.value; if (t.id === "xai-r") V.sheet.req = t.value;
  if (t.id === "xai-t") { V.sheet.text = t.value; clearTimeout(window.__xai); window.__xai = setTimeout(() => { const p0 = t.selectionStart, y = (document.querySelector(".sheet") || {}).scrollTop; const w = $("sheetwrap"); if (w) w.remove(); render(); const el = $("xai-t"); if (el) { el.focus(); el.setSelectionRange(p0, p0); } const sh2 = document.querySelector(".sheet"); if (sh2 && y) sh2.scrollTop = y; }, 400); } });
document.addEventListener("paste", e => { if (!(V.sheet && V.sheet.k === "x-medit")) return; const f = [...(e.clipboardData.items || [])].find(x => x.type.startsWith("image/")); if (f) { e.preventDefault(); exAddFig(f.getAsFile()); } });
window.exView = exView; window.exSheet = exSheet; window.exDrawMermaid = exDrawMermaid;
