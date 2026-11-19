/* Anki2：カードの図の型（FIG）。Mathkey などのカードが、このファイルを読みこんで図を描く。
   新しい図の型はここに足すだけでよい（ノートタイプを貼り直さなくてよい）。 */
/* ===== 図の型（FIG）。AI は「型と数」だけを決め、線・文字の置き方はここで決める ===== */
(function () {
  if (window.FIG && window.FIG.v === 2) return;
  var F = window.FIG = { v: 2 };
  var NS = 'http://www.w3.org/2000/svg', PI = Math.PI;

  function el(tag, at, p) { var e = document.createElementNS(NS, tag); for (var k in at) if (at[k] !== undefined) e.setAttribute(k, at[k]); if (p) p.appendChild(e); return e; }
  function n1(v) { return Math.round(v * 10) / 10; }
  function isVar(s) { return /^([A-Za-zα-ωθ]|[A-Za-z]['′]?|[A-Za-z]_?\d)$/.test(String(s)); }
  function T(p, x, y, s, cls, anchor) {
    s = String(s); if (s === '') return null;
    var c = 'lb' + (cls ? ' ' + cls : '') + (isVar(s) ? ' var' : '');
    var t = el('text', { x: n1(x), y: n1(y), 'class': c, 'text-anchor': anchor || 'middle', 'dominant-baseline': 'central' }, p);
    t.textContent = s; return t;
  }
  function svgOf(w, h, label) {
    var s = el('svg', { viewBox: '0 0 ' + Math.round(w) + ' ' + Math.round(h), width: Math.round(w), height: Math.round(h), role: 'img', 'aria-label': label || '図' });
    var d = el('defs', {}, s);
    [['fgA', 'ahd'], ['fgK', 'ahk'], ['fgF', 'ahf']].forEach(function (m) {
      var mk = el('marker', { id: m[0], viewBox: '0 0 10 10', refX: 8.5, refY: 5, markerWidth: 7, markerHeight: 7, markerUnits: 'userSpaceOnUse', orient: 'auto-start-reverse' }, d);
      var sz = m[0] === 'fgA' ? 9 : 12; mk.setAttribute('markerWidth', sz); mk.setAttribute('markerHeight', sz);
      el('path', { d: 'M0 1 L9 5 L0 9 Z', 'class': m[1] }, mk);
    });
    return s;
  }
  function L(p, x1, y1, x2, y2, cls, arrow) { return el('line', { x1: n1(x1), y1: n1(y1), x2: n1(x2), y2: n1(y2), 'class': cls, 'marker-end': arrow ? 'url(#' + arrow + ')' : undefined }, p); }
  function arc(cx, cy, r, a0, a1) { /* 角度は度、反時計回り（画面では y が下向きなので符号に注意） */
    var p0 = [cx + r * Math.cos(a0 * PI / 180), cy - r * Math.sin(a0 * PI / 180)], p1 = [cx + r * Math.cos(a1 * PI / 180), cy - r * Math.sin(a1 * PI / 180)];
    return 'M' + n1(p0[0]) + ' ' + n1(p0[1]) + ' A' + r + ' ' + r + ' 0 ' + (Math.abs(a1 - a0) > 180 ? 1 : 0) + ' 0 ' + n1(p1[0]) + ' ' + n1(p1[1]);
  }
  function axes(s, X, Y, x0, x1, y0, y1, opt) {
    opt = opt || {};
    L(s, X(x0), Y(0), X(x1), Y(0), 'axis', 'fgA'); L(s, X(0), Y(y0), X(0), Y(y1), 'axis', 'fgA');
    if (opt.names !== false) { T(s, X(x1) - 2, Y(0) + 13, opt.xn || 'x', 'sub'); T(s, X(0) + 12, Y(y1) + 4, opt.yn || 'y', 'sub'); }
    if (opt.o !== false) T(s, X(0) - 10, Y(0) + 12, 'O', 'sub');
  }
  function angDeg(dx, dy) { return Math.atan2(-dy, dx) * 180 / PI; }  /* 画面の向きから数学の角へ */

  var D = {};

  /* 単位円：{t:"unit", deg:角度, f:"cos"|"sin"|"tan"|"none", label:"角の書き方"} */
  D.unit = function (p) {
    var deg = +p.deg || 0, f = p.f || 'none', th = deg * PI / 180, c = Math.cos(th), sn = Math.sin(th), tn = Math.abs(c) < 1e-9 ? null : sn / c;
    var nd = ((deg % 360) + 360) % 360, quarter = nd > 0 && nd < 90 && (f !== 'tan' || tn <= 2.2);
    if (f === 'tan' && (tn === null || Math.abs(tn) > 2.2)) f = 'none';
    var u = quarter ? 140 : 88, pad = 28, xs = quarter ? [0, 1.08] : [-1.14, 1.14], ys = quarter ? [0, 1.08] : [-1.14, 1.14];
    if (f === 'tan') { ys[0] = Math.min(ys[0], tn - 0.1); ys[1] = Math.max(ys[1], tn + 0.1); }
    var extra = f === 'cos' || f === 'none' ? 30 : 84, W = (xs[1] - xs[0]) * u + pad * 2 + extra, H = (ys[1] - ys[0]) * u + pad * 2 + 10;
    function X(x) { return pad + (quarter ? 8 : 0) + (x - xs[0]) * u; } function Y(y) { return pad + (ys[1] - y) * u; }
    var s = svgOf(W, H, '単位円'), ox = X(0), oy = Y(0);
    L(s, X(xs[0]) - (quarter ? 10 : 0), oy, X(xs[1]) + 4, oy, 'axis', 'fgA'); L(s, ox, Y(ys[0]) + (quarter ? 10 : 0), ox, Y(ys[1]) - 4, 'axis', 'fgA');
    if (quarter) el('path', { d: 'M' + n1(X(1)) + ' ' + n1(oy) + ' A' + u + ' ' + u + ' 0 0 0 ' + n1(ox) + ' ' + n1(Y(1)), 'class': 'shape' }, s);
    else el('circle', { cx: n1(ox), cy: n1(oy), r: u, 'class': 'shape' }, s);
    var px = X(c), py = Y(sn);
    if (f === 'tan') {
      L(s, X(1), Y(ys[0]), X(1), Y(ys[1]), 'guide');
      L(s, ox, oy, X(1), Y(tn), nd < 90 || nd > 270 ? 'main' : 'guide');
      if (!(nd < 90 || nd > 270)) L(s, ox, oy, px, py, 'main');
      L(s, X(1), oy, X(1), Y(tn), 'key'); T(s, X(1) + 10, (oy + Y(tn)) / 2, 'tan', 'key-t', 'start');
    } else {
      L(s, ox, oy, px, py, 'main');
      if (f === 'cos') { L(s, px, py, px, oy, 'guide'); L(s, ox, oy, px, oy, 'key'); T(s, px + (c < 0 ? -6 : 6), oy + (sn >= 0 ? 15 : -13), 'cos', 'key-t', c < 0 ? 'end' : 'start'); }
      if (f === 'sin') { L(s, px, py, ox, py, 'guide'); L(s, px, oy, px, py, 'key'); T(s, px + (c >= 0 ? 10 : -10), (oy + py) / 2, 'sin', 'key-t', c >= 0 ? 'start' : 'end'); }
    }
    var ar = quarter ? 30 : 24; if (nd > 0.01) el('path', { d: arc(ox, oy, ar, 0, nd), 'class': 'ang' }, s);
    var half = nd / 2, lr = quarter && nd < 30 ? ar + 34 : (quarter ? ar + 16 : ar + 26); if (quarter && nd < 30) half = nd / 2.3;
    T(s, ox + lr * Math.cos(half * PI / 180), oy - lr * Math.sin(half * PI / 180), p.label || (n1(deg) + '°'), 'ang-t');
    el('circle', { cx: n1(px), cy: n1(py), r: 4, 'class': 'dot' }, s);
    T(s, ox + (c < 0 ? 10 : -10), oy + 13, 'O', 'sub'); T(s, px + (c >= 0 ? 9 : -9), py + (sn >= 0 ? -12 : 12), 'P', 'sub');
    if (!quarter || true) T(s, (ox + px) / 2 - (sn >= 0 ? 8 : -8) * Math.sin(th), (oy + py) / 2 - 8 * Math.cos(th), '1', 'sub');
    return s;
  };

  /* 扇形：{t:"sector", deg:中心角, r:"r", arc:"l", angle:"θ", fill:1} */
  D.sector = function (p) {
    var deg = Math.max(10, Math.min(170, +p.deg || 60)), R = 150, th = deg * PI / 180;
    var minx = Math.min(0, R * Math.cos(th)), W = R - minx + 90, H = R * Math.sin(Math.min(th, PI / 2)) + 60, o = [30 - minx, H - 26];
    var s = svgOf(W, H, '扇形'), A = [o[0] + R, o[1]], B = [o[0] + R * Math.cos(th), o[1] - R * Math.sin(th)];
    el('path', { d: 'M' + n1(o[0]) + ' ' + n1(o[1]) + ' L' + n1(A[0]) + ' ' + n1(A[1]) + ' A' + R + ' ' + R + ' 0 0 0 ' + n1(B[0]) + ' ' + n1(B[1]) + ' Z', 'class': p.fill === 0 ? 'shape' : 'shape fill' }, s);
    el('path', { d: arc(o[0], o[1], R, 0, deg), 'class': 'key' }, s);
    el('path', { d: arc(o[0], o[1], 30, 0, deg), 'class': 'ang' }, s);
    var h = th / 2; T(s, o[0] + 46 * Math.cos(h), o[1] - 46 * Math.sin(h), p.angle == null ? 'θ' : p.angle, 'ang-t');
    T(s, (o[0] + A[0]) / 2, o[1] + 14, p.r == null ? 'r' : p.r, 'sub');
    T(s, (o[0] + B[0]) / 2 - 13 * Math.sin(th), (o[1] + B[1]) / 2 - 13 * Math.cos(th), p.r == null ? 'r' : p.r, 'sub');
    T(s, o[0] + (R + 18) * Math.cos(h), o[1] - (R + 18) * Math.sin(h), p.arc == null ? 'l' : p.arc, 'key-t', Math.cos(h) > 0.2 ? 'start' : 'middle');
    el('circle', { cx: n1(o[0]), cy: n1(o[1]), r: 3, 'class': 'dot' }, s);
    return s;
  };

  /* 座標平面の直線：{t:"line", m:傾き, b:切片, name:"ℓ", show:["slope","intercept","normal"], pt:[x,y], ptName:"P", vx:縦の線のx} */
  D.line = function (p) {
    var m = p.m == null ? 1 : +p.m, b = p.b == null ? 0 : +p.b, show = p.show || [], vx = p.vx;
    var x0 = -1.2, x1 = 4.2, ys = [b, m * x0 + b, m * x1 + b, 0], y0 = Math.max(-3.5, Math.min.apply(null, ys) - 0.6), y1 = Math.min(5.5, Math.max.apply(null, ys.concat([2])) + 0.6);
    if (p.pt) { y0 = Math.min(y0, p.pt[1] - 0.6); y1 = Math.max(y1, p.pt[1] + 0.6); }
    var u = Math.min(46, 250 / (x1 - x0), 230 / (y1 - y0)), pad = 22, W = (x1 - x0) * u + pad * 2, H = (y1 - y0) * u + pad * 2;
    function X(x) { return pad + (x - x0) * u; } function Y(y) { return pad + (y1 - y) * u; }
    var s = svgOf(W, H, '直線'), cid = 'fgc' + Math.floor(Math.random() * 1e6);
    var cp = el('clipPath', { id: cid }, s.firstChild); el('rect', { x: pad - 2, y: pad - 2, width: W - 2 * pad + 4, height: H - 2 * pad + 4 }, cp);
    axes(s, X, Y, x0, x1, y0, y1);
    var g = el('g', { 'clip-path': 'url(#' + cid + ')' }, s);
    if (vx != null) L(g, X(vx), Y(y0), X(vx), Y(y1), 'main');
    else L(g, X(x0), Y(m * x0 + b), X(x1), Y(m * x1 + b), 'main');
    var nx = vx != null ? vx : 3.4, ny = vx != null ? y1 - 0.8 : m * 3.4 + b;
    if (ny > y1 - 0.4) { nx = (y1 - 0.5 - b) / m; ny = y1 - 0.5; } if (ny < y0 + 0.4) { nx = (y0 + 0.5 - b) / m; ny = y0 + 0.5; }
    if (p.name !== '') T(s, X(nx) + 10, Y(ny) - 2, p.name || 'ℓ', 'sub', 'start');
    if (vx == null && show.indexOf('slope') >= 0) {
      var sx = Math.max(0.5, Math.min(2, x1 - 1.5)), sy = m * sx + b;
      L(s, X(sx), Y(sy), X(sx + 1), Y(sy), 'guide'); L(s, X(sx + 1), Y(sy), X(sx + 1), Y(sy + m), 'key');
      T(s, X(sx + 0.5), Y(sy) + (m >= 0 ? 12 : -12), '1', 'sub'); T(s, X(sx + 1) + 8, Y(sy + m / 2), p.mName || ('' + m), 'key-t', 'start');
    }
    if (vx == null && show.indexOf('intercept') >= 0) { el('circle', { cx: n1(X(0)), cy: n1(Y(b)), r: 4, 'class': 'dot key-dot' }, s); T(s, X(0) - 9, Y(b) - 2, p.bName || ('' + b), 'key-t', 'end'); }
    if (show.indexOf('normal') >= 0) {
      var qx = vx != null ? vx : 1.2, qy = vx != null ? 1.5 : m * 1.2 + b, dx = vx != null ? 1 : -m, dy = vx != null ? 0 : 1, len = Math.sqrt(dx * dx + dy * dy); dx /= len; dy /= len;
      var ex = qx + dx * 1.3, ey = qy + dy * 1.3; L(s, X(qx), Y(qy), X(ex), Y(ey), 'key', 'fgK');
      T(s, X(ex) + 8, Y(ey) - 6, p.nName || 'n', 'key-t', 'start');
      var sq = 7, ux = dx, uy = dy, vxx = vx != null ? 0 : 1 / Math.sqrt(1 + m * m), vyy = vx != null ? 1 : m / Math.sqrt(1 + m * m);
      el('path', { d: 'M' + n1(X(qx) + vxx * sq) + ' ' + n1(Y(qy) - vyy * sq) + ' l' + n1(ux * sq) + ' ' + n1(-uy * sq) + ' l' + n1(-vxx * sq) + ' ' + n1(vyy * sq), 'class': 'ang' }, s);
    }
    if (p.pt) { el('circle', { cx: n1(X(p.pt[0])), cy: n1(Y(p.pt[1])), r: 4, 'class': 'dot' }, s); T(s, X(p.pt[0]) + 8, Y(p.pt[1]) - 10, p.ptName || 'P', 'sub', 'start'); }
    return s;
  };

  /* 三角形：{t:"tri", shape:"any"|"right"|"obtuse"|"iso", names:["A","B","C"], sides:{a:"a",b:"b",c:"c"}, angles:["A"], hl:["a","A"]} */
  D.tri = function (p) {
    var sh = p.shape || 'any', P = { any: [[1.7, 3.1], [0, 0], [5, 0]], right: [[4.4, 3], [0, 0], [4.4, 0]], obtuse: [[0, 2.5], [1.9, 0], [5.3, 0]], iso: [[2.5, 3.4], [0, 0], [5, 0]] }[sh] || [[1.7, 3.1], [0, 0], [5, 0]];
    var nm = p.names || ['A', 'B', 'C'], sides = p.sides || {}, angs = p.angles || [], hl = p.hl || [];
    var xs = P.map(function (q) { return q[0]; }), ys = P.map(function (q) { return q[1]; });
    var mnx = Math.min.apply(null, xs), mxx = Math.max.apply(null, xs), mxy = Math.max.apply(null, ys), u = 46, pad = 30;
    var W = (mxx - mnx) * u + pad * 2, H = mxy * u + pad * 2;
    function X(x) { return pad + (x - mnx) * u; } function Y(y) { return pad + (mxy - y) * u; }
    var s = svgOf(W, H, '三角形'), V = P.map(function (q) { return [X(q[0]), Y(q[1])]; });
    var gx = (V[0][0] + V[1][0] + V[2][0]) / 3, gy = (V[0][1] + V[1][1] + V[2][1]) / 3;
    el('path', { d: 'M' + V.map(function (v) { return n1(v[0]) + ' ' + n1(v[1]); }).join(' L') + ' Z', 'class': 'shape fill' }, s);
    /* 辺：a は向かいの辺（BC）、b は CA、c は AB */
    var SIDE = { a: [1, 2], b: [2, 0], c: [0, 1] };
    ['a', 'b', 'c'].forEach(function (k) {
      var e = SIDE[k], P1 = V[e[0]], P2 = V[e[1]];
      if (hl.indexOf(k) >= 0) L(s, P1[0], P1[1], P2[0], P2[1], 'key');
      if (sides[k] == null || sides[k] === '') return;
      var mx = (P1[0] + P2[0]) / 2, my = (P1[1] + P2[1]) / 2, dx = mx - gx, dy = my - gy, l = Math.sqrt(dx * dx + dy * dy) || 1;
      T(s, mx + dx / l * 15, my + dy / l * 15, sides[k], hl.indexOf(k) >= 0 ? 'key-t' : 'sub');
    });
    V.forEach(function (v, k) {
      var dx = v[0] - gx, dy = v[1] - gy, l = Math.sqrt(dx * dx + dy * dy) || 1;
      T(s, v[0] + dx / l * 16, v[1] + dy / l * 14, nm[k], 'sub');
      var o1 = V[(k + 1) % 3], o2 = V[(k + 2) % 3], a1 = angDeg(o1[0] - v[0], o1[1] - v[1]), a2 = angDeg(o2[0] - v[0], o2[1] - v[1]);
      var isRight = sh === 'right' && k === 2;
      if (isRight) { var r = 11, u1 = [(o1[0] - v[0]), (o1[1] - v[1])], u2 = [(o2[0] - v[0]), (o2[1] - v[1])], l1 = Math.sqrt(u1[0] * u1[0] + u1[1] * u1[1]), l2 = Math.sqrt(u2[0] * u2[0] + u2[1] * u2[1]);
        el('path', { d: 'M' + n1(v[0] + u1[0] / l1 * r) + ' ' + n1(v[1] + u1[1] / l1 * r) + ' l' + n1(u2[0] / l2 * r) + ' ' + n1(u2[1] / l2 * r) + ' l' + n1(-u1[0] / l1 * r) + ' ' + n1(-u1[1] / l1 * r), 'class': 'ang' }, s); }
      if (angs.indexOf(nm[k]) >= 0 && !isRight) {
        var lo = Math.min(a1, a2), hi = Math.max(a1, a2); if (hi - lo > 180) { var t = lo; lo = hi; hi = t + 360; }
        el('path', { d: arc(v[0], v[1], 20, lo, hi), 'class': hl.indexOf(nm[k]) >= 0 ? 'key thin' : 'ang' }, s);
      }
    });
    return s;
  };

  /* ベクトル：{t:"vec", a:[x,y], b:[x,y], la:"a", lb:"b", show:"sum"|"diff"|"none"} */
  D.vec = function (p) {
    var a = p.a || [3, 1], b = p.b || [1, 2], show = p.show || 'none', pts = [[0, 0], a, b];
    if (show === 'sum') pts.push([a[0] + b[0], a[1] + b[1]]);
    var xs = pts.map(function (q) { return q[0]; }), ys = pts.map(function (q) { return q[1]; });
    var x0 = Math.min.apply(null, xs) - 0.4, x1 = Math.max.apply(null, xs) + 0.6, y0 = Math.min.apply(null, ys) - 0.4, y1 = Math.max.apply(null, ys) + 0.6;
    var u = Math.min(56, 250 / (x1 - x0), 210 / (y1 - y0)), pad = 22, W = (x1 - x0) * u + pad * 2 + 30, H = (y1 - y0) * u + pad * 2;
    function X(x) { return pad + (x - x0) * u; } function Y(y) { return pad + (y1 - y) * u; }
    var s = svgOf(W, H, 'ベクトル');
    function lab(P1, P2, t, cls, side) { var mx = (X(P1[0]) + X(P2[0])) / 2, my = (Y(P1[1]) + Y(P2[1])) / 2, dx = X(P2[0]) - X(P1[0]), dy = Y(P2[1]) - Y(P1[1]), l = Math.sqrt(dx * dx + dy * dy) || 1, sg = side || 1; T(s, mx + dy / l * 14 * sg, my - dx / l * 14 * sg, t, cls); }
    if (show === 'sum') { var c = [a[0] + b[0], a[1] + b[1]]; L(s, X(a[0]), Y(a[1]), X(c[0]), Y(c[1]), 'guide'); L(s, X(b[0]), Y(b[1]), X(c[0]), Y(c[1]), 'guide'); L(s, X(0), Y(0), X(c[0]), Y(c[1]), 'key', 'fgK'); lab([0, 0], c, p.ls || (p.la || 'a') + '+' + (p.lb || 'b'), 'key-t', -1); }
    if (show === 'diff') { L(s, X(b[0]), Y(b[1]), X(a[0]), Y(a[1]), 'key', 'fgK'); lab(b, a, p.ld || (p.la || 'a') + '−' + (p.lb || 'b'), 'key-t', 1); }
    L(s, X(0), Y(0), X(a[0]), Y(a[1]), 'main', 'fgF'); L(s, X(0), Y(0), X(b[0]), Y(b[1]), 'main', 'fgF');
    lab([0, 0], a, p.la || 'a', 'vec-t', -1); lab([0, 0], b, p.lb || 'b', 'vec-t', 1);
    el('circle', { cx: n1(X(0)), cy: n1(Y(0)), r: 3, 'class': 'dot' }, s); T(s, X(0) - 10, Y(0) + 10, p.o || 'O', 'sub');
    return s;
  };

  /* sin・cos のグラフ：{t:"wave", f:"sin"|"cos", A:振幅, k:角の係数, shift:ずれ（πの何倍か）, show:["period","amp","shift"]} */
  D.wave = function (p) {
    var f = p.f === 'cos' ? Math.cos : Math.sin, A = p.A == null ? 1 : +p.A, k = p.k == null ? 1 : +p.k, sh = (p.shift == null ? 0 : +p.shift) * PI, show = p.show || [];
    var per = 2 * PI / Math.abs(k), xa = Math.min(0, sh) - 0.15, xb = Math.max(2 * PI, sh + per) + 0.55, ym = Math.max(1, Math.abs(A)) + 0.45;
    var ux = 270 / (xb - xa), uy = Math.min(46, 70 / ym), pad = 22, top = show.indexOf('period') >= 0 ? 22 : 0, W = (xb - xa) * ux + pad * 2 + 10, H = 2 * ym * uy + pad * 2 + top + 6;
    function X(x) { return pad + (x - xa) * ux; } function Y(y) { return pad + top + (ym - y) * uy; }
    var s = svgOf(W, H, 'グラフ');
    L(s, X(xa), Y(0), X(xb), Y(0), 'axis', 'fgA'); L(s, X(0), Y(-ym), X(0), Y(ym), 'axis', 'fgA');
    T(s, X(xb) - 2, Y(0) + 13, 'x', 'sub'); T(s, X(0) - 10, Y(0) + 12, 'O', 'sub');
    var step = PI / 2, names = { 1: 'π/2', 2: 'π', 3: '3π/2', 4: '2π', 5: '5π/2', 6: '3π', 8: '4π' };
    for (var q = 1; q * step <= xb - 0.1; q++) { var tx = X(q * step); L(s, tx, Y(0) - 3, tx, Y(0) + 3, 'axis'); if (names[q] && (q % 2 === 0 || xb < 7)) T(s, tx, Y(0) + 14, names[q], 'tick'); }
    [1, -1].forEach(function (v) { if (Math.abs(A) !== 1 || v) { L(s, X(0) - 3, Y(v * Math.abs(A)), X(0) + 3, Y(v * Math.abs(A)), 'axis'); } });
    T(s, X(0) - 8, Y(Math.abs(A)), String(Math.abs(A)), 'tick', 'end'); T(s, X(0) - 8, Y(-Math.abs(A)), '−' + Math.abs(A), 'tick', 'end');
    var d = '', N = 160; for (var i = 0; i <= N; i++) { var x = xa + (xb - xa) * i / N, y = A * f(k * (x - sh)); d += (i ? ' L' : 'M') + n1(X(x)) + ' ' + n1(Y(y)); }
    el('path', { d: d, 'class': 'curve' }, s);
    if (show.indexOf('period') >= 0) { var py = pad + 6; L(s, X(sh), py, X(sh + per), py, 'key', 'fgK'); L(s, X(sh + per), py, X(sh), py, 'key', 'fgK'); T(s, X(sh + per / 2), py - 1, '周期', 'key-t lbg'); L(s, X(sh), py + 4, X(sh), Y(0), 'guide'); L(s, X(sh + per), py + 4, X(sh + per), Y(0), 'guide'); }
    if (show.indexOf('amp') >= 0) { var axp = sh + (p.f === 'cos' ? (show.indexOf('shift') >= 0 ? per : 0) : per / 4); L(s, X(axp), Y(0), X(axp), Y(A), 'key', 'fgK'); T(s, X(axp) + 8, Y(A / 2), '振幅', 'key-t', 'start'); }
    if (show.indexOf('shift') >= 0 && sh) { L(s, X(0), Y(0) - 8, X(sh), Y(0) - 8, 'key', 'fgK'); T(s, X(sh / 2), Y(0) - 20, 'ずれ', 'key-t'); }
    return s;
  };

  /* 数直線：{t:"num", lo:-3, hi:5, ranges:[[a,b,"[)","α","β"]], points:[[x,"P"]], ticks:1} */
  D.num = function (p) {
    var lo = p.lo == null ? -3 : +p.lo, hi = p.hi == null ? 5 : +p.hi, rs = p.ranges || [], ps = p.points || [];
    var pad = 24, W = 300, u = (W - pad * 2) / (hi - lo), H = 74, yb = 40;
    function X(x) { return pad + (x - lo) * u; }
    var s = svgOf(W, H, '数直線');
    L(s, pad - 10, yb, W - pad + 12, yb, 'axis', 'fgA');
    if (p.ticks !== 0 && hi - lo <= 14) for (var t = Math.ceil(lo); t <= hi; t++) { L(s, X(t), yb - 3, X(t), yb + 3, 'axis'); T(s, X(t), yb + 15, String(t).replace('-', '−'), 'tick'); }
    rs.forEach(function (r, i) {
      var a = r[0] == null ? lo - 0.4 : +r[0], b = r[1] == null ? hi + 0.4 : +r[1], br = r[2] || '[]', y = yb - 13 - i * 9;
      L(s, r[1] == null ? X(a) : X(b), y, r[1] == null ? X(b) : X(a), y, 'key', (r[0] == null || r[1] == null) ? 'fgK' : undefined);
      if (r[0] != null) { el('circle', { cx: n1(X(a)), cy: y, r: 4.5, 'class': br.charAt(0) === '[' ? 'dot key-dot' : 'odot' }, s); if (r[3]) T(s, X(a), y - 12, r[3], 'key-t'); }
      if (r[1] != null) { el('circle', { cx: n1(X(b)), cy: y, r: 4.5, 'class': br.charAt(1) === ']' ? 'dot key-dot' : 'odot' }, s); if (r[4]) T(s, X(b), y - 12, r[4], 'key-t'); }
    });
    ps.forEach(function (q) { el('circle', { cx: n1(X(+q[0])), cy: yb, r: 4, 'class': 'dot' }, s); if (q[1]) T(s, X(+q[0]), yb - 13, q[1], 'sub'); });
    return s;
  };


  /* 和積：単位円の2点 A・B。{t:"sumprod", A:70, B:20, show:"sum"|"diff"|"both"}
     和：A と B の中点 M。M = cosβ・(cosα, sinα)
     差：A と B′（B の反対側の点）の中点 N。N = ((cosA−cosB)/2, (sinA−sinB)/2)。OMAN は長方形なので ON = MA = sinβ、ON は y 軸と角 α
     α=(A+B)/2、β=(A−B)/2 */
  D.sumprod = function (p) {
    var A = p.A == null ? 70 : +p.A, B = p.B == null ? 20 : +p.B, show = p.show || 'sum';
    var a = A * PI / 180, b = B * PI / 180, h = (a + b) / 2;
    var full = show !== 'sum', R = full ? 150 : 150, pad = 30, left = full ? 20 : 92;
    var ox = left + (full ? R : 0), oy = pad + R + 6;
    var low = full ? 0.42 : 0, W = ox + R + pad + 30, lines = show === 'both' ? 4 : (show === 'diff' ? 3 : 2), H = oy + low * R + 34 + lines * 18;
    function X(x) { return ox + x * R; } function Y(y) { return oy - y * R; }
    var s = svgOf(W, H, '和積の図');
    if (full) { L(s, X(-1.12), oy, X(1.15), oy, 'axis', 'fgA'); L(s, ox, Y(-low), ox, Y(1.12), 'axis', 'fgA'); el('path', { d: arc(ox, oy, R, -24, 204), 'class': 'shape' }, s); }
    else { L(s, X(-0.16), oy, X(1.12), oy, 'axis', 'fgA'); L(s, ox, Y(-0.12), ox, Y(1.12), 'axis', 'fgA'); el('path', { d: 'M' + n1(X(1)) + ' ' + n1(oy) + ' A' + R + ' ' + R + ' 0 0 0 ' + n1(ox) + ' ' + n1(Y(1)), 'class': 'shape' }, s); }
    var PA = [Math.cos(a), Math.sin(a)], PB = [Math.cos(b), Math.sin(b)], PB2 = [-PB[0], -PB[1]];
    var M = [(PA[0] + PB[0]) / 2, (PA[1] + PB[1]) / 2], N = [(PA[0] + PB2[0]) / 2, (PA[1] + PB2[1]) / 2];
    var mx = X(M[0]), my = Y(M[1]), nx = X(N[0]), ny = Y(N[1]);
    L(s, ox, oy, X(PA[0]), Y(PA[1]), 'main'); L(s, ox, oy, X(PB[0]), Y(PB[1]), 'main');
    function rmark(px, py, d1, d2) { var r = 8; el('path', { d: 'M' + n1(px + d1[0] * r) + ' ' + n1(py + d1[1] * r) + ' l' + n1(d2[0] * r) + ' ' + n1(d2[1] * r) + ' l' + n1(-d1[0] * r) + ' ' + n1(-d1[1] * r), 'class': 'ang' }, s); }
    if (show !== 'diff') {
      L(s, X(PB[0]), Y(PB[1]), X(PA[0]), Y(PA[1]), 'guide');
      L(s, mx, my, mx, oy, 'guide'); L(s, mx, my, ox, my, 'guide');
      L(s, ox, oy, mx, my, 'key');
      T(s, mx, oy + 15, '(cosA+cosB)/2', 'tick');
      if (!full) T(s, ox - 6, my, '(sinA+sinB)/2', 'tick', 'end'); else T(s, mx + 8, my - 2, '', 'tick');
      T(s, (ox + mx) / 2 + 12 * Math.sin(h) + 2, (oy + my) / 2 + 12 * Math.cos(h) + 2, 'cos β', 'key-t', 'start');
      el('path', { d: arc(ox, oy, 34, 0, h * 180 / PI), 'class': 'ang' }, s);
      var ha = (b + h) / 2; T(s, ox + 48 * Math.cos(ha), oy - 48 * Math.sin(ha), 'α', 'ang-t');
      el('path', { d: arc(ox, oy, 58, h * 180 / PI, A), 'class': 'ang' }, s);
      var hb = (h + a) / 2; T(s, ox + 72 * Math.cos(hb), oy - 72 * Math.sin(hb), 'β', 'ang-t');
    }
    if (show !== 'sum') {
      /* B の反対側の点 B′ と、A・B′ の中点 N */
      L(s, ox, oy, X(PB2[0]), Y(PB2[1]), 'guide');
      L(s, X(PB2[0]), Y(PB2[1]), X(PA[0]), Y(PA[1]), 'guide');
      if (show === 'diff') { L(s, ox, oy, mx, my, 'guide'); }
      L(s, mx, my, X(PA[0]), Y(PA[1]), 'guide'); L(s, nx, ny, X(PA[0]), Y(PA[1]), 'guide');
      rmark(ox, oy, [Math.cos(h), -Math.sin(h)], [-Math.sin(h), -Math.cos(h)]);
      L(s, nx, ny, nx, oy, 'guide'); L(s, nx, ny, ox, ny, 'guide');
      L(s, ox, oy, nx, ny, 'key');
      T(s, nx, oy + 15, '(cosA−cosB)/2', 'tick', 'end');
      T(s, nx - 8, ny - 10, '(sinA−sinB)/2', 'tick', 'end');
      T(s, (ox + nx) / 2 - 12, (oy + ny) / 2 + 10, 'sin β', 'key-t', 'end');
      el('path', { d: arc(ox, oy, 26, 90, 90 + h * 180 / PI), 'class': 'ang' }, s);
      var hn = PI / 2 + h / 2; T(s, ox + 38 * Math.cos(hn), oy - 38 * Math.sin(hn), 'α', 'ang-t');
      el('circle', { cx: n1(X(PB2[0])), cy: n1(Y(PB2[1])), r: 4, 'class': 'odot' }, s); T(s, X(PB2[0]) - 8, Y(PB2[1]) + 10, 'B′', 'sub', 'end');
      el('circle', { cx: n1(nx), cy: n1(ny), r: 4, 'class': 'dot key-dot' }, s); T(s, nx - 4, ny - 26, 'N', 'sub', 'end');
      if (show === 'diff') el('circle', { cx: n1(mx), cy: n1(my), r: 3.5, 'class': 'odot' }, s);
    }
    [[PA, 'A'], [PB, 'B']].forEach(function (q) { el('circle', { cx: n1(X(q[0][0])), cy: n1(Y(q[0][1])), r: 4, 'class': 'dot' }, s); T(s, X(q[0][0]) + 9, Y(q[0][1]) - 9, q[1], 'sub', 'start'); });
    if (show !== 'diff') { el('circle', { cx: n1(mx), cy: n1(my), r: 4, 'class': 'dot key-dot' }, s); }
    T(s, mx + 9, my + 11, 'M', 'sub', 'start');
    T(s, ox - 10, oy + 12, 'O', 'sub');
    var cy = oy + low * R + 36, lx = 12;
    T(s, lx, cy, 'α = (A+B)/2,  β = (A−B)/2', 'note', 'start'); cy += 18;
    if (show !== 'diff') { T(s, lx, cy, 'M（A と B の中点）= cos β・(cos α, sin α)', 'note key-n', 'start'); cy += 18; }
    if (show !== 'sum') {
      T(s, lx, cy, 'B′ は B の反対側の点。N は A と B′ の中点', 'note', 'start'); cy += 18;
      T(s, lx, cy, 'OMAN は長方形 → ON = MA = sin β、ON は y 軸と角 α', 'note key-n', 'start');
    }
    return s;
  };


  /* 積和：単位円の 2 点 A（角 α+β）・B（角 α−β）と、その中点 M。{t:"prodsum", al:46, be:24, show:"sin"|"cos"|"both"}
     OM は角 α の向きで長さ cosβ → M = (cosα cosβ, sinα cosβ)
     MA ⊥ OM、MA = MB = sinβ。MA は縦から α 傾く → 縦 cosα sinβ・横 sinα sinβ
     sin：高さ（y 座標）で見る　cos：横（x 座標）で見る */
  D.prodsum = function (p) {
    var al = (p.al == null ? 46 : +p.al) * PI / 180, be = (p.be == null ? 24 : +p.be) * PI / 180, show = p.show || 'sin';
    var useY = show !== 'cos', useX = show !== 'sin';
    var R = 180, left = useY ? 104 : 34, top = 30, ox = left, oy = top + R * 1.06;
    var X = function (x) { return ox + x * R; }, Y = function (y) { return oy - y * R; };
    var PA = [Math.cos(al + be), Math.sin(al + be)], PB = [Math.cos(al - be), Math.sin(al - be)], M = [(PA[0] + PB[0]) / 2, (PA[1] + PB[1]) / 2];
    var nl = show === 'both' ? 11 : 7, below = useX ? 50 : 22, W = X(1.12) + 96, H = oy + below + 10 + nl * 19;
    var s = svgOf(W, H, '積和の図');
    L(s, ox - 12, oy, X(1.14), oy, 'axis', 'fgA'); L(s, ox, oy + 12, ox, Y(1.1), 'axis', 'fgA');
    el('path', { d: 'M' + n1(X(1)) + ' ' + n1(oy) + ' A' + R + ' ' + R + ' 0 0 0 ' + n1(ox) + ' ' + n1(Y(1)), 'class': 'shape' }, s);
    var ax = X(PA[0]), ay = Y(PA[1]), bx = X(PB[0]), by = Y(PB[1]), mx = X(M[0]), my = Y(M[1]);
    L(s, ox, oy, ax, ay, 'main'); L(s, ox, oy, bx, by, 'main'); L(s, ax, ay, bx, by, 'guide');
    L(s, ox, oy, mx, my, 'key');
    /* OM ⊥ AB の印 */
    var u = [Math.cos(al), -Math.sin(al)], v = [-Math.sin(al), -Math.cos(al)], r = 9;
    el('path', { d: 'M' + n1(mx - u[0] * r) + ' ' + n1(my - u[1] * r) + ' l' + n1(v[0] * r) + ' ' + n1(v[1] * r) + ' l' + n1(u[0] * r) + ' ' + n1(u[1] * r), 'class': 'ang' }, s);
    T(s, (ox + mx) / 2 + 13 * Math.sin(al), (oy + my) / 2 + 13 * Math.cos(al) + 2, 'cos β', 'key-t', 'start');
    /* 角：x 軸→OM が α、OM→OA と OB→OM が β */
    el('path', { d: arc(ox, oy, 30, 0, al * 180 / PI), 'class': 'ang' }, s);
    T(s, ox + 42 * Math.cos(al / 2), oy - 42 * Math.sin(al / 2), 'α', 'ang-t');
    el('path', { d: arc(ox, oy, 56, al * 180 / PI, (al + be) * 180 / PI), 'class': 'ang' }, s);
    T(s, ox + 68 * Math.cos(al + be / 2), oy - 68 * Math.sin(al + be / 2), 'β', 'ang-t');
    el('path', { d: arc(ox, oy, 56, (al - be) * 180 / PI, al * 180 / PI), 'class': 'ang' }, s);
    T(s, ox + 68 * Math.cos(al - be / 2), oy - 68 * Math.sin(al - be / 2), 'β', 'ang-t');
    /* M から A・B へのずれ：縦の段差（sin）と横の段差（cos） */
    if (useY) {
      [[PA, ay], [M, my], [PB, by]].forEach(function (q, i) { L(s, X(q[0][0]), q[1], ox, q[1], 'guide'); });
      T(s, ox - 7, ay, 'sin(α+β)', 'tick', 'end'); T(s, ox - 7, my, 'sinα cosβ', 'key-t sm', 'end'); T(s, ox - 7, by, 'sin(α−β)', 'tick', 'end');
      var sx = X(1.03);
      L(s, sx, ay, sx, my, 'key'); L(s, sx, my, sx, by, 'key');
      L(s, X(PB[0]) + 4, ay, sx + 4, ay, 'guide'); L(s, mx, my, sx + 4, my, 'guide'); L(s, bx, by, sx + 4, by, 'guide');
      T(s, sx + 7, (ay + my) / 2, 'cosα sinβ', 'key-t sm', 'start'); T(s, sx + 7, (my + by) / 2, 'cosα sinβ', 'key-t sm', 'start');
    }
    if (useX) {
      [[PA, ax], [M, mx], [PB, bx]].forEach(function (q) { L(s, q[1], Y(q[0][1]), q[1], oy, 'guide'); });
      T(s, ax, oy + 15, 'cos(α+β)', 'tick'); T(s, mx, oy + 33, 'cosα cosβ', 'key-t sm'); T(s, bx, oy + 15, 'cos(α−β)', 'tick');
      var sy = Y(1.06);
      L(s, ax, sy, mx, sy, 'key'); L(s, mx, sy, bx, sy, 'key');
      L(s, ax, ay, ax, sy - 4, 'guide'); L(s, mx, my, mx, sy - 4, 'guide'); L(s, bx, by, bx, sy - 4, 'guide');
      T(s, (ax + mx) / 2, sy - 11, 'sinα sinβ', 'key-t sm'); T(s, (mx + bx) / 2, sy - 11, 'sinα sinβ', 'key-t sm');
    }
    [[PA, 'A', ax, ay], [PB, 'B', bx, by]].forEach(function (q) { el('circle', { cx: n1(q[2]), cy: n1(q[3]), r: 4, 'class': 'dot' }, s); T(s, q[2] + 9, q[3] - 9, q[1], 'sub', 'start'); });
    el('circle', { cx: n1(mx), cy: n1(my), r: 4.5, 'class': 'dot key-dot' }, s); T(s, mx - 12, my - 10, 'M', 'sub', 'end');
    T(s, ox - 10, oy + 12, 'O', 'sub');
    var cy = oy + below + 10, lx = 8, t = function (str, k) { T(s, lx, cy, str, 'note' + (k ? ' key-n' : ''), 'start'); cy += 19; };
    t('① A は角 α+β、B は角 α−β の点（半径 1）。M は AB の中点');
    t('② OM は角 α の向きで長さ cosβ → M = (cosα cosβ, sinα cosβ)');
    t('③ MA = MB = sinβ。OM と直角なので、縦から α 傾く');
    if (useY) {
      t('④ M の高さは A と B の高さのちょうど真ん中');
      t('　 sinα cosβ = ½{sin(α+β) + sin(α−β)}', 1);
      t('⑤ A は M より cosα sinβ 高く、B は同じだけ低い');
      t('　 cosα sinβ = ½{sin(α+β) − sin(α−β)}', 1);
    }
    if (useX) {
      t((useY ? '⑥' : '④') + ' M の横は A と B の横のちょうど真ん中');
      t('　 cosα cosβ = ½{cos(α+β) + cos(α−β)}', 1);
      t((useY ? '⑦' : '⑤') + ' A は M より sinα sinβ 左、B は同じだけ右');
      t('　 sinα sinβ = −½{cos(α+β) − cos(α−β)}', 1);
    }
    return s;
  };


  /* 合成：a sinθ + b cosθ = r sin(θ+α)。{t:"synth", a:√3≒1.732, b:1, la:"√3", lb:"1", show:"point"|"wave"}
     point：点 P(a, b)。OP = r、x 軸からの角が α（sin の係数が x、cos の係数が y）
     wave ：a sinθ と b cosθ を足すと、高さ r・左に α ずれた sin になる */
  D.synth = function (p) {
    var a = p.a == null ? 1.732 : +p.a, b = p.b == null ? 1 : +p.b, la = p.la == null ? String(a) : String(p.la), lb = p.lb == null ? String(b) : String(p.lb);
    var r = Math.sqrt(a * a + b * b), al = Math.atan2(b, a);
    var ca = la === '1' ? '' : la + ' ', cb = lb === '1' ? '' : lb + ' ';
    var s;
    if (p.show === 'rotate') {
      /* P(a, b) を θ だけ回すと Q。Q の高さ = a sinθ（横の辺の高さ）+ b cosθ（縦の辺の高さ）= r sin(θ+α) */
      var th = (p.deg == null ? 45 : +p.deg) * PI / 180, c = Math.cos(th), sn = Math.sin(th);
      var Rp = [a * c, a * sn], Qp = [a * c - b * sn, a * sn + b * c];
      var xmax = Math.max(a, Rp[0]) + 0.75, ymax = Math.max(b, Qp[1]) + 0.25, uu = Math.min(95, 210 / xmax, 190 / ymax), pd = 28;
      var Wr = Math.max(xmax * uu + pd * 2 + 80, 390), ox2 = pd + 12, oy2 = pd + ymax * uu, Hr = oy2 + 34 + 8 * 18 + 14;
      var X3 = function (x) { return ox2 + x * uu; }, Y3 = function (y) { return oy2 - y * uu; };
      s = svgOf(Wr, Hr, '合成を回して見る図');
      L(s, ox2 - 10, oy2, X3(xmax), oy2, 'axis', 'fgA'); L(s, ox2, oy2 + 10, ox2, Y3(ymax), 'axis', 'fgA');
      /* もとの三角形（点 P）はうすく */
      el('path', { d: 'M' + n1(ox2) + ' ' + n1(oy2) + ' L' + n1(X3(a)) + ' ' + n1(oy2) + ' L' + n1(X3(a)) + ' ' + n1(Y3(b)) + ' Z', 'class': 'guide' }, s);
      T(s, X3(a / 2), oy2 + 12, la, 'tick'); T(s, X3(a) + 9, Y3(b / 2) + 8, lb, 'tick', 'start');
      el('circle', { cx: n1(X3(a)), cy: n1(Y3(b)), r: 3, 'class': 'odot' }, s); T(s, X3(a) + 7, Y3(b) + 5, 'P', 'tick', 'start');
      /* 回した三角形 O-R-Q */
      el('path', { d: 'M' + n1(ox2) + ' ' + n1(oy2) + ' L' + n1(X3(Rp[0])) + ' ' + n1(Y3(Rp[1])) + ' L' + n1(X3(Qp[0])) + ' ' + n1(Y3(Qp[1])) + ' Z', 'class': 'shape fill' }, s);
      L(s, ox2, oy2, X3(Qp[0]), Y3(Qp[1]), 'main');
      T(s, X3(Rp[0] / 2) + 10 * sn, Y3(Rp[1] / 2) + 10 * c + 4, la, 'sub');
      T(s, X3((Rp[0] + Qp[0]) / 2) - 11 * c, Y3((Rp[1] + Qp[1]) / 2) + 11 * sn, lb, 'sub');
      T(s, X3(Qp[0] / 2) - 10, Y3(Qp[1] / 2) - 4, 'r', 'sub', 'end');
      /* 高さのものさし：下が a sinθ、上が b cosθ */
      var bx = X3(xmax - 0.35);
      L(s, X3(Rp[0]), Y3(Rp[1]), bx, Y3(Rp[1]), 'guide'); L(s, X3(Qp[0]), Y3(Qp[1]), bx, Y3(Qp[1]), 'guide');
      L(s, bx, oy2, bx, Y3(Rp[1]), 'main'); L(s, bx, Y3(Rp[1]), bx, Y3(Qp[1]), 'key');
      T(s, bx + 7, (oy2 + Y3(Rp[1])) / 2, ca + 'sinθ', 'tick', 'start');
      T(s, bx + 7, (Y3(Rp[1]) + Y3(Qp[1])) / 2, cb + 'cosθ', 'key-t sm', 'start');
      var rx = X3(Rp[0]), ry = Y3(Rp[1]);
      L(s, rx, ry, rx, ry - Math.min(70, b * uu * 0.9), 'guide');
      el('path', { d: arc(rx, ry, 24, 90, 90 + th * 180 / PI), 'class': 'ang' }, s);
      T(s, rx + 36 * Math.cos(PI / 2 + th / 2), ry - 36 * Math.sin(PI / 2 + th / 2), 'θ', 'ang-t');
      el('circle', { cx: n1(rx), cy: n1(ry), r: 3, 'class': 'dot' }, s); T(s, rx + 8, ry + 4, 'R', 'tick', 'start');
      el('circle', { cx: n1(X3(Qp[0])), cy: n1(Y3(Qp[1])), r: 4.5, 'class': 'dot key-dot' }, s); T(s, X3(Qp[0]) - 2, Y3(Qp[1]) - 12, 'Q', 'sub');
      /* 角：θ は x 軸から OR、α は OR から OQ */
      el('path', { d: arc(ox2, oy2, 30, 0, th * 180 / PI), 'class': 'ang' }, s);
      T(s, ox2 + 43 * Math.cos(th / 2), oy2 - 43 * Math.sin(th / 2), 'θ', 'ang-t');
      el('path', { d: arc(ox2, oy2, 52, th * 180 / PI, (th + al) * 180 / PI), 'class': 'ang' }, s);
      T(s, ox2 + 65 * Math.cos(th + al / 2), oy2 - 65 * Math.sin(th + al / 2), 'α', 'ang-t');
      T(s, ox2 - 10, oy2 + 12, 'O', 'sub');
      var cy2 = oy2 + 34, lx2 = 6, st = [
        ['① ' + ca + 'sinθ + ' + cb + 'cosθ を、1つの sin にまとめたい', ''],
        ['② 横 ' + la + '・縦 ' + lb + ' の直角三角形を作る（点線）', ''],
        ['　 斜辺 r = √(' + la + '² + ' + lb + '²)、斜辺の角を α とする', ''],
        ['③ この三角形を、O のまわりに θ だけ回す', ''],
        ['④ 横の辺 ' + la + ' は角 θ に傾く → 先の R の高さ = ' + ca + 'sinθ', ''],
        ['⑤ 縦の辺 ' + lb + ' も真上から θ 傾く → 上がる高さ = ' + cb + 'cosθ', ''],
        ['⑥ だから斜辺の先 Q の高さ = ' + ca + 'sinθ + ' + cb + 'cosθ', ''],
        ['⑦ 一方 OQ は長さ r・角 θ + α → Q の高さ = r sin(θ + α)', ''],
        ['⑧ よって ' + ca + 'sinθ + ' + cb + 'cosθ = r sin(θ + α)', 'key-n']
      ];
      st.forEach(function (q) { T(s, lx2, cy2, q[0], 'note' + (q[1] ? ' ' + q[1] : ''), 'start'); cy2 += 18; });
      return s;
    }
    if (p.show === 'wave') {
      var ux = 250 / (2 * PI + 0.9), ym = r + 0.35, uy = Math.min(40, 80 / ym), pad = 24, xa = -0.75, xb = 2 * PI + 0.25;
      var W = (xb - xa) * ux + pad * 2 + 24, H = 2 * ym * uy + pad * 2 + 30 + 2 * 18;
      var X = function (x) { return pad + (x - xa) * ux; }, Y = function (y) { return pad + (ym - y) * uy; };
      s = svgOf(W, H, '合成のグラフ');
      L(s, X(xa), Y(0), X(xb), Y(0), 'axis', 'fgA'); L(s, X(0), Y(-ym), X(0), Y(ym), 'axis', 'fgA');
      T(s, X(xb) + 12, Y(0), 'θ', 'sub'); T(s, X(0) + 9, Y(0) + 12, 'O', 'sub');
      [[PI, 'π'], [2 * PI, '2π']].forEach(function (q) { L(s, X(q[0]), Y(0) - 3, X(q[0]), Y(0) + 3, 'axis'); T(s, X(q[0]), Y(0) + 14, q[1], 'tick'); });
      function wave(fn, cls) { var d = ''; for (var i = 0; i <= 160; i++) { var x = xa + (xb - xa) * i / 160; d += (i ? ' L' : 'M') + n1(X(x)) + ' ' + n1(Y(fn(x))); } return el('path', { d: d, 'class': cls }, s); }
      wave(function (x) { return a * Math.sin(x); }, 'guide'); wave(function (x) { return b * Math.cos(x); }, 'guide');
      wave(function (x) { return r * Math.sin(x + al); }, 'curve');
      /* 高さ r と、左に α のずれ */
      var pk = PI / 2 - al; L(s, X(pk), Y(0), X(pk), Y(r), 'key', 'fgK'); T(s, X(pk) + 7, Y(r * 0.55), 'r', 'key-t', 'start');
      L(s, X(0), Y(0) + 22, X(-al), Y(0) + 22, 'key', 'fgK'); T(s, X(-al / 2), Y(0) + 34, 'α', 'key-t');
      T(s, X(PI * 1.25), Y(a * Math.sin(PI * 1.25)) + 14, ca + 'sinθ', 'tick'); T(s, X(PI * 1.62), Y(b * Math.cos(PI * 1.62)) - 10, cb + 'cosθ', 'tick');
      var cy = Y(-ym) + 30, lx = 8;
      T(s, lx, cy, '細い線2本（' + ca + 'sinθ と ' + cb + 'cosθ）を足すと太い線', 'note', 'start'); cy += 18;
      T(s, lx, cy, '太い線 = 高さ r の sin を、左に α ずらしたもの', 'note key-n', 'start');
      return s;
    }
    var u = Math.min(150 / Math.max(a, 0.6), 120 / Math.max(b, 0.6)), pad = 30, W = Math.max(a * u + pad * 2 + 70, 330), H = b * u + pad * 2 + 30 + 6 * 18;
    var ox = pad + 20, oy = pad + b * u;
    var X2 = function (x) { return ox + x * u; }, Y2 = function (y) { return oy - y * u; };
    s = svgOf(W, H, '合成の図');
    L(s, ox - 12, oy, X2(a) + 40, oy, 'axis', 'fgA'); L(s, ox, oy + 12, ox, Y2(b) - 26, 'axis', 'fgA');
    L(s, X2(a), Y2(b), X2(a), oy, 'guide'); L(s, X2(a), Y2(b), ox, Y2(b), 'guide');
    L(s, ox, oy, X2(a), Y2(b), 'key');
    el('path', { d: arc(ox, oy, 34, 0, al * 180 / PI), 'class': 'ang' }, s); T(s, ox + 48 * Math.cos(al / 2), oy - 48 * Math.sin(al / 2), 'α', 'ang-t');
    el('circle', { cx: n1(X2(a)), cy: n1(Y2(b)), r: 4.5, 'class': 'dot key-dot' }, s);
    T(s, X2(a) + 8, Y2(b) - 10, 'P(' + la + ', ' + lb + ')', 'sub', 'start');
    T(s, X2(a), oy + 15, la, 'tick'); T(s, ox - 8, Y2(b), lb, 'tick', 'end');
    T(s, X2(a / 2) - 14 * Math.sin(al) - 4, Y2(b / 2) - 14 * Math.cos(al), 'r', 'key-t', 'end');
    T(s, ox - 10, oy + 12, 'O', 'sub');
    T(s, X2(a) + 44, oy - 10, 'sin の係数', 'tick', 'end'); T(s, ox + 8, Y2(b) - 22, 'cos の係数', 'tick', 'start');
    var cy = oy + 40, lx = 8;
    T(s, lx, cy, ca + 'sinθ + ' + cb + 'cosθ = r sin(θ + α)', 'note', 'start'); cy += 18;
    T(s, lx, cy, 'r = OP = √(a² + b²)、α = OP の角', 'note key-n', 'start'); cy += 18;
    T(s, lx, cy, 'sin の係数を横、cos の係数を縦にとる', 'note', 'start'); cy += 18;
    T(s, lx, cy, '図から ' + la + ' = r cos α、' + lb + ' = r sin α。これを入れると', 'note', 'start'); cy += 18;
    T(s, lx, cy, ca + 'sinθ + ' + cb + 'cosθ = r(sinθ cos α + cosθ sin α)', 'note', 'start'); cy += 18;
    T(s, lx, cy, '= r sin(θ + α)（加法定理）', 'note key-n', 'start');
    return s;
  };


  /* 加法定理（台形）：{t:"addthm", show:"sin"|"cos"|"both", A:25, B:40}
     左下 O から長さ 1 の OC（角 α+β）。OB = cosβ（角 α）、BC = sinβ（OB に直角）。
     O・B・C を囲む直角台形 OPQC（下 OP・上 QC は横、右 PQ は縦、左 OC は斜め）。
     右の辺 PQ = PB + BQ = cosβ sinα + sinβ cosα = sin(α+β)、下 − 上 = cosβ cosα − sinβ sinα = cos(α+β) */
  D.addthm = function (p) {
    if (p.sign === '-' || /-$/.test(String(p.show || ''))) return D.addminus(p);
    if (p.show === 'tan') return D.addtan(p);
    var al = (p.A == null ? 25 : +p.A) * PI / 180, be = (p.B == null ? 40 : +p.B) * PI / 180, show = p.show || 'both';
    var cb = Math.cos(be), sb = Math.sin(be);
    var B = [cb * Math.cos(al), cb * Math.sin(al)], C = [Math.cos(al + be), Math.sin(al + be)], P = [B[0], 0], Q = [B[0], C[1]];
    var u = 270, pad = 34, ox = pad + 16, oy = pad + C[1] * u + 4;
    var nst = show === 'both' ? 8 : 6, capY = show === 'sin' ? 46 : 62, W = Math.max(ox + P[0] * u + 120, 420), H = oy + capY + nst * 18;
    function X(x) { return ox + x * u; } function Y(y) { return oy - y * u; }
    var s = svgOf(W, H, '加法定理の台形');
    /* 台形 OPQC */
    el('path', { d: 'M' + n1(X(0)) + ' ' + n1(Y(0)) + ' L' + n1(X(P[0])) + ' ' + n1(Y(0)) + ' L' + n1(X(Q[0])) + ' ' + n1(Y(Q[1])) + ' L' + n1(X(C[0])) + ' ' + n1(Y(C[1])) + ' Z', 'class': 'shape fill' }, s);
    /* 中の線 OB・BC */
    L(s, X(0), Y(0), X(B[0]), Y(B[1]), 'main'); L(s, X(B[0]), Y(B[1]), X(C[0]), Y(C[1]), 'main');
    function rmark(Pt, d1, d2) { var r = 9, px = X(Pt[0]), py = Y(Pt[1]); el('path', { d: 'M' + n1(px + d1[0] * r) + ' ' + n1(py - d1[1] * r) + ' l' + n1(d2[0] * r) + ' ' + n1(-d2[1] * r) + ' l' + n1(-d1[0] * r) + ' ' + n1(d1[1] * r), 'class': 'ang' }, s); }
    rmark(P, [-1, 0], [0, 1]); rmark(Q, [-1, 0], [0, -1]);
    rmark(B, [-Math.cos(al), -Math.sin(al)], [-Math.sin(al), Math.cos(al)]);
    /* 辺の強調：sin は右の辺（下 PB・上 BQ）、cos は下の辺と上の辺 */
    if (show !== 'cos') {
      L(s, X(P[0]), Y(0), X(B[0]), Y(B[1]), 'key2'); L(s, X(B[0]), Y(B[1]), X(Q[0]), Y(Q[1]), 'key');
      T(s, X(P[0]) + 10, (Y(0) + Y(B[1])) / 2, 'cosβ sinα', 'k2-t sm', 'start');
      T(s, X(Q[0]) + 10, (Y(B[1]) + Y(Q[1])) / 2, 'sinβ cosα', 'key-t sm', 'start');
    }
    if (show !== 'sin') {
      L(s, X(0), Y(0), X(P[0]), Y(0), 'key2'); L(s, X(C[0]), Y(C[1]), X(Q[0]), Y(Q[1]), 'key');
      T(s, X(P[0] / 2), Y(0) + 15, 'cosβ cosα', 'k2-t sm');
      T(s, X((C[0] + Q[0]) / 2), Y(C[1]) - 13, 'sinβ sinα', 'key-t sm');
      /* C の真下 D まで点線。OD = OP − QC = cos(α+β) */
      L(s, X(C[0]), Y(C[1]), X(C[0]), Y(0), 'guide');
      var by = Y(0) + 32; L(s, X(0), by, X(C[0]), by, 'ang'); L(s, X(0), by - 4, X(0), by + 4, 'ang'); L(s, X(C[0]), by - 4, X(C[0]), by + 4, 'ang');
      T(s, X(C[0]) + 6, by, 'cos(α+β)', 'tick', 'start');
    }
    /* 中の長さ */
    T(s, X(B[0] * 0.74) + 4, Y(B[1] * 0.74) + 16, 'cosβ', 'sub', 'start');
    T(s, X(B[0] * 0.7 + C[0] * 0.3) - 9, Y(B[1] * 0.7 + C[1] * 0.3) - 4, 'sinβ', 'sub', 'end');
    T(s, X(C[0] / 2) - 10, Y(C[1] / 2), '1', 'sub', 'end');
    /* 角：O の α・β、B の α（縦の辺 BQ と BC の間） */
    el('path', { d: arc(X(0), Y(0), 36, 0, al * 180 / PI), 'class': 'ang' }, s); T(s, X(0) + 50 * Math.cos(al / 2), Y(0) - 50 * Math.sin(al / 2), 'α', 'ang-t');
    el('path', { d: arc(X(0), Y(0), 56, al * 180 / PI, (al + be) * 180 / PI), 'class': 'ang' }, s); T(s, X(0) + 69 * Math.cos(al + be / 2), Y(0) - 69 * Math.sin(al + be / 2), 'β', 'ang-t');
    el('path', { d: arc(X(B[0]), Y(B[1]), 24, 90, 90 + al * 180 / PI), 'class': 'ang' }, s);
    T(s, X(B[0]) + 36 * Math.cos(PI / 2 + al / 2), Y(B[1]) - 36 * Math.sin(PI / 2 + al / 2), 'α', 'ang-t');
    [[C, 'C', -4, -12], [B, 'B', -12, 10], [P, 'P', 0, 15], [Q, 'Q', 8, -10]].forEach(function (q) { T(s, X(q[0][0]) + q[2], Y(q[0][1]) + q[3], q[1], 'tick'); });
    T(s, X(0) - 10, Y(0) + 12, 'O', 'sub');
    var cy = oy + capY, lx = 6, st = [
      ['① 長さ 1 の OC を角 α+β にとる（C の高さ = sin(α+β)、横 = cos(α+β)）', 0],
      ['② OC を、角 α の OB（= cosβ）と、OB に直角な BC（= sinβ）に分ける', 0],
      ['③ O・B・C を、下と上が横・右が縦の台形 OPQC で囲む', 0],
      ['④ BC は縦の辺 BQ から α だけ傾く（直角どうしで角が移る）', 0]];
    if (show !== 'cos') st.push(['⑤ 右の辺 = C の高さ：PQ = PB + BQ', 0], ['　 → sin(α+β) = sinα cosβ + cosα sinβ', 1]);
    if (show !== 'sin') st.push([(show === 'both' ? '⑥' : '⑤') + ' 下 − 上 = C の横：OP − QC', 0], ['　 → cos(α+β) = cosα cosβ − sinα sinβ', 1]);
    st.forEach(function (q) { T(s, lx, cy, q[0], 'note' + (q[1] ? ' key-n' : ''), 'start'); cy += 18; });
    return s;
  };


  /* 加法定理（正接）：同じ直角台形で、下の辺を 1 にしたもの。{t:"addthm", show:"tan"}
     OP = 1、PB = tanα、BC ⊥ OB で ∠BOC = β。BQ = tanβ、QC = tanα tanβ。tan(α+β) = (tanα + tanβ) / (1 − tanα tanβ) */
  D.addtan = function (p) {
    var al = (p.A == null ? 25 : +p.A) * PI / 180, be = (p.B == null ? 35 : +p.B) * PI / 180, ta = Math.tan(al), tb = Math.tan(be);
    var P = [1, 0], B = [1, ta], Q = [1, ta + tb], C = [1 - ta * tb, ta + tb];
    var u = 200, pad = 34, ox = pad + 16, oy = pad + Q[1] * u + 4, capY = 62, W = Math.max(ox + u + 130, 420), H = oy + capY + 8 * 18;
    function X(x) { return ox + x * u; } function Y(y) { return oy - y * u; }
    var s = svgOf(W, H, '正接の加法定理の台形');
    el('path', { d: 'M' + n1(X(0)) + ' ' + n1(Y(0)) + ' L' + n1(X(P[0])) + ' ' + n1(Y(0)) + ' L' + n1(X(Q[0])) + ' ' + n1(Y(Q[1])) + ' L' + n1(X(C[0])) + ' ' + n1(Y(C[1])) + ' Z', 'class': 'shape fill' }, s);
    L(s, X(0), Y(0), X(B[0]), Y(B[1]), 'main'); L(s, X(B[0]), Y(B[1]), X(C[0]), Y(C[1]), 'main');
    function rmark(Pt, d1, d2) { var r = 9, px = X(Pt[0]), py = Y(Pt[1]); el('path', { d: 'M' + n1(px + d1[0] * r) + ' ' + n1(py - d1[1] * r) + ' l' + n1(d2[0] * r) + ' ' + n1(-d2[1] * r) + ' l' + n1(-d1[0] * r) + ' ' + n1(d1[1] * r), 'class': 'ang' }, s); }
    rmark(P, [-1, 0], [0, 1]); rmark(Q, [-1, 0], [0, -1]); rmark(B, [-Math.cos(al), -Math.sin(al)], [-Math.sin(al), Math.cos(al)]);
    /* 辺：右（PB・BQ）と上（QC）、下（OP = 1） */
    L(s, X(P[0]), Y(0), X(B[0]), Y(B[1]), 'key2'); L(s, X(B[0]), Y(B[1]), X(Q[0]), Y(Q[1]), 'key');
    L(s, X(C[0]), Y(C[1]), X(Q[0]), Y(Q[1]), 'key'); L(s, X(0), Y(0), X(P[0]), Y(0), 'key2');
    T(s, X(P[0]) + 10, (Y(0) + Y(B[1])) / 2, 'tanα', 'k2-t sm', 'start');
    T(s, X(Q[0]) + 10, (Y(B[1]) + Y(Q[1])) / 2, 'tanβ', 'key-t sm', 'start');
    T(s, X((C[0] + Q[0]) / 2), Y(C[1]) - 13, 'tanα tanβ', 'key-t sm');
    T(s, X(0.5), Y(0) + 15, '1', 'k2-t sm');
    /* C の真下まで点線。横 = 1 − tanα tanβ、高さ = tanα + tanβ */
    L(s, X(C[0]), Y(C[1]), X(C[0]), Y(0), 'guide');
    var by = Y(0) + 32; L(s, X(0), by, X(C[0]), by, 'ang'); L(s, X(0), by - 4, X(0), by + 4, 'ang'); L(s, X(C[0]), by - 4, X(C[0]), by + 4, 'ang');
    T(s, X(C[0]) + 6, by, '横 = 1 − tanα tanβ', 'tick', 'start');
    /* 中の長さ */
    T(s, X(0.78) + 2, Y(0.78 * ta) + 16, '1/cosα', 'sub', 'start');
    /* 角 */
    el('path', { d: arc(X(0), Y(0), 36, 0, al * 180 / PI), 'class': 'ang' }, s); T(s, X(0) + 50 * Math.cos(al / 2), Y(0) - 50 * Math.sin(al / 2), 'α', 'ang-t');
    el('path', { d: arc(X(0), Y(0), 56, al * 180 / PI, (al + be) * 180 / PI), 'class': 'ang' }, s); T(s, X(0) + 69 * Math.cos(al + be / 2), Y(0) - 69 * Math.sin(al + be / 2), 'β', 'ang-t');
    el('path', { d: arc(X(B[0]), Y(B[1]), 24, 90, 90 + al * 180 / PI), 'class': 'ang' }, s);
    T(s, X(B[0]) + 36 * Math.cos(PI / 2 + al / 2), Y(B[1]) - 36 * Math.sin(PI / 2 + al / 2), 'α', 'ang-t');
    [[C, 'C', -4, -12], [B, 'B', -12, 10], [P, 'P', 0, 15], [Q, 'Q', 8, -10]].forEach(function (q) { T(s, X(q[0][0]) + q[2], Y(q[0][1]) + q[3], q[1], 'tick'); });
    T(s, X(0) - 10, Y(0) + 12, 'O', 'sub');
    var cy = oy + capY, lx = 6, st = [
      ['① 横 1 の OP、その真上に B（PB = tanα）。OB = 1/cosα', 0],
      ['② B で OB に直角に BC、∠BOC = β（BC = OB tanβ = tanβ/cosα）', 0],
      ['③ BC は縦から α 傾く → BQ = BC cosα = tanβ', 0],
      ['　 QC = BC sinα = tanα tanβ', 0],
      ['④ C の高さ = PB + BQ = tanα + tanβ', 0],
      ['⑤ C の横 = OP − QC = 1 − tanα tanβ', 0],
      ['⑥ OC の傾き = 高さ ÷ 横（角は α+β）', 0],
      ['　 → tan(α+β) = (tanα + tanβ) / (1 − tanα tanβ)', 1]];
    st.forEach(function (q) { T(s, lx, cy, q[0], 'note' + (q[1] ? ' key-n' : ''), 'start'); cy += 18; });
    return s;
  };


  /* 加法定理（引き算 α−β）：{t:"addthm", show:"sin-"|"cos-"|"both-"|"tan-"}（または sign:"-"）
     OB は角 α、BC は OB に直角で「下向き」、∠BOC = β なので OC の角は α−β。
     O・B・C を、下と上が横・右が縦の直角台形 ODQB で囲む（C は右の縦の辺の上）。
     sin/cos：OB = cosβ、BC = sinβ。右の辺 DQ = B の高さ = sinα cosβ、その上の部分 CQ = cosα sinβ、上の辺 BQ = sinα sinβ
       → sin(α−β) = DC = sinα cosβ − cosα sinβ、cos(α−β) = OD = OP + PD = cosα cosβ + sinα sinβ
     tan：横 OP = 1、PB = tanα。CQ = tanβ、BQ = tanα tanβ → tan(α−β) = (tanα − tanβ) / (1 + tanα tanβ) */
  D.addminus = function (p) {
    var show = String(p.show || 'both').replace(/-$/, ''), isTan = show === 'tan';
    var al = (p.A == null ? (isTan ? 50 : 60) : +p.A) * PI / 180, be = (p.B == null ? 25 : +p.B) * PI / 180;
    var len = isTan ? 1 / Math.cos(al) : Math.cos(be), bc = isTan ? Math.tan(be) / Math.cos(al) : Math.sin(be);
    var B = [len * Math.cos(al), len * Math.sin(al)], C = [B[0] + bc * Math.sin(al), B[1] - bc * Math.cos(al)];
    var P = [B[0], 0], Dd = [C[0], 0], Q = [C[0], B[1]];
    var u = isTan ? Math.min(175, 300 / C[0]) : 300, pad = 34, ox = pad + 16, oy = pad + B[1] * u + 4;
    var lines = isTan ? 8 : (show === 'both' ? 8 : 6), capY = 62, W = Math.max(ox + C[0] * u + 120, 420), H = oy + capY + lines * 18;
    function X(x) { return ox + x * u; } function Y(y) { return oy - y * u; }
    var s = svgOf(W, H, '加法定理（引き算）の台形');
    el('path', { d: 'M' + n1(X(0)) + ' ' + n1(Y(0)) + ' L' + n1(X(Dd[0])) + ' ' + n1(Y(0)) + ' L' + n1(X(Q[0])) + ' ' + n1(Y(Q[1])) + ' L' + n1(X(B[0])) + ' ' + n1(Y(B[1])) + ' Z', 'class': 'shape fill' }, s);
    L(s, X(0), Y(0), X(C[0]), Y(C[1]), 'main'); L(s, X(B[0]), Y(B[1]), X(C[0]), Y(C[1]), 'main');
    L(s, X(B[0]), Y(B[1]), X(P[0]), Y(0), 'guide');
    function rmark(Pt, d1, d2) { var r = 9, px = X(Pt[0]), py = Y(Pt[1]); el('path', { d: 'M' + n1(px + d1[0] * r) + ' ' + n1(py - d1[1] * r) + ' l' + n1(d2[0] * r) + ' ' + n1(-d2[1] * r) + ' l' + n1(-d1[0] * r) + ' ' + n1(d1[1] * r), 'class': 'ang' }, s); }
    rmark(Dd, [-1, 0], [0, 1]); rmark(Q, [-1, 0], [0, -1]); rmark(B, [-Math.cos(al), -Math.sin(al)], [Math.sin(al), -Math.cos(al)]);
    var tA = isTan ? 'tanα' : 'sinα cosβ', tU = isTan ? 'tanβ' : 'cosα sinβ', tT = isTan ? 'tanα tanβ' : 'sinα sinβ', tO = isTan ? '1' : 'cosα cosβ';
    if (show !== 'cos') {
      /* 右の辺：全体（B の高さ）から上の部分 CQ を引くと C の高さ */
      L(s, X(Dd[0]), Y(0), X(Q[0]), Y(Q[1]), 'key2'); L(s, X(C[0]), Y(C[1]), X(Q[0]), Y(Q[1]), 'key');
      T(s, X(Q[0]) + 10, (Y(C[1]) + Y(Q[1])) / 2, tU, 'key-t sm', 'start');
      T(s, X(Q[0]) + 10, (Y(0) + Y(C[1])) / 2, '右の辺全体 = ' + tA, 'k2-t sm', 'start');
      if (!isTan) T(s, X(Dd[0]) - 7, Y(C[1] * 0.4), 'DC = sin(α−β)', 'tick', 'end');
    }
    if (show !== 'sin') {
      /* 下の辺：OP（B の真下まで）+ PD（= 上の辺 BQ） */
      L(s, X(0), Y(0), X(P[0]), Y(0), 'key2'); L(s, X(P[0]), Y(0), X(Dd[0]), Y(0), 'key'); L(s, X(B[0]), Y(B[1]), X(Q[0]), Y(Q[1]), 'key');
      T(s, X(P[0] / 2), Y(0) + 15, tO, 'k2-t sm'); T(s, X((P[0] + Dd[0]) / 2), Y(0) + 15, tT, 'key-t sm');
      T(s, X((B[0] + Q[0]) / 2), Y(B[1]) - 13, tT, 'key-t sm');
      if (!isTan) { var by = Y(0) + 32; L(s, X(0), by, X(Dd[0]), by, 'ang'); L(s, X(0), by - 4, X(0), by + 4, 'ang'); L(s, X(Dd[0]), by - 4, X(Dd[0]), by + 4, 'ang'); T(s, X(Dd[0]) + 6, by, 'OD = cos(α−β)', 'tick', 'start'); }
    }
    if (isTan) { L(s, X(B[0]), Y(B[1]), X(Q[0]), Y(Q[1]), 'key'); T(s, X((B[0] + Q[0]) / 2), Y(B[1]) - 13, tT, 'key-t sm'); }
    T(s, X(C[0] * 0.72) + 2, Y(C[1] * 0.72) + 15, isTan ? '' : '1', 'sub', 'start');
    T(s, X(B[0] * 0.5) - 10 * Math.sin(al) - 4, Y(B[1] * 0.5) - 10 * Math.cos(al), isTan ? '1/cosα' : 'cosβ', 'sub', 'end');
    T(s, X((B[0] + C[0]) / 2) - 6, Y((B[1] + C[1]) / 2) + 12, isTan ? '' : 'sinβ', 'sub', 'end');
    /* 角：O の α（x 軸から OB）、β（OC から OB）、C の α（縦の辺と CB の間） */
    var ac = Math.atan2(C[1], C[0]);
    el('path', { d: arc(X(0), Y(0), 34, 0, al * 180 / PI), 'class': 'ang' }, s); T(s, X(0) + 47 * Math.cos(al * 0.62), Y(0) - 47 * Math.sin(al * 0.62), 'α', 'ang-t');
    el('path', { d: arc(X(0), Y(0), 56, ac * 180 / PI, al * 180 / PI), 'class': 'ang' }, s); T(s, X(0) + 69 * Math.cos((ac + al) / 2), Y(0) - 69 * Math.sin((ac + al) / 2), 'β', 'ang-t');
    el('path', { d: arc(X(C[0]), Y(C[1]), 22, 90, 90 + al * 180 / PI), 'class': 'ang' }, s);
    T(s, X(C[0]) + 33 * Math.cos(PI / 2 + al / 2), Y(C[1]) - 33 * Math.sin(PI / 2 + al / 2), 'α', 'ang-t');
    [[C, 'C', 9, 4], [B, 'B', -4, -12], [P, 'P', 0, 15], [Q, 'Q', 8, -10], [Dd, 'D', 8, 12]].forEach(function (q) { T(s, X(q[0][0]) + q[2], Y(q[0][1]) + q[3], q[1], 'tick', q[1] === 'C' || q[1] === 'D' ? 'start' : 'middle'); });
    el('circle', { cx: n1(X(C[0])), cy: n1(Y(C[1])), r: 4, 'class': 'dot key-dot' }, s);
    T(s, X(0) - 10, Y(0) + 12, 'O', 'sub');
    var cy = oy + capY, lx = 6, st;
    if (isTan) st = [
      ['① 横 1 の OP、その真上に B（PB = tanα）。OB の角は α', 0],
      ['② B で OB に直角に「下向き」に BC、∠BOC = β（OC の角は α−β）', 0],
      ['③ BC は縦から α 傾く → CQ = tanβ、BQ = tanα tanβ', 0],
      ['④ C の高さ = 右の辺 − CQ = tanα − tanβ', 0],
      ['⑤ C の横 = OP + PD = 1 + tanα tanβ（PD = BQ）', 0],
      ['⑥ OC の傾き = 高さ ÷ 横', 0],
      ['　 → tan(α−β) = (tanα − tanβ) / (1 + tanα tanβ)', 1]];
    else {
      st = [
        ['① 角 α の OB（= cosβ）から、直角に「下向き」に BC（= sinβ）', 0],
        ['② OC は長さ 1、角は α−β（β だけ下がる）', 0],
        ['③ O・B・C を、下と上が横・右が縦の台形 ODQB で囲む', 0],
        ['④ BC は縦から α 傾く → CQ = cosα sinβ、BQ = sinα sinβ', 0]];
      if (show !== 'cos') st.push(['⑤ C の高さ = 右の辺（B の高さ）− CQ', 0], ['　 → sin(α−β) = sinα cosβ − cosα sinβ', 1]);
      if (show !== 'sin') st.push([(show === 'both' ? '⑥' : '⑤') + ' C の横 = OP + PD（PD = BQ）', 0], ['　 → cos(α−β) = cosα cosβ + sinα sinβ', 1]);
    }
    st.forEach(function (q) { T(s, lx, cy, q[0], 'note' + (q[1] ? ' key-n' : ''), 'start'); cy += 18; });
    return s;
  };

  /* 型の名前は日本語でもよい */
  var ALIAS = { '加法定理': 'addthm', '合成': 'synth', '和積': 'sumprod', '積和': 'prodsum', '単位円': 'unit', '扇形': 'sector', '直線': 'line', '三角形': 'tri', 'ベクトル': 'vec', 'グラフ': 'wave', '数直線': 'num', triangle: 'tri', vector: 'vec', numline: 'num', circle: 'unit' };
  /* 図の欄は1つでも複数でもよい：{…} / [{…},{…}] / {…}{…}（改行や , で区切ってもよい） */
  function one(o) { if (!o || typeof o !== 'object' || Array.isArray(o)) return null; o.t = ALIAS[o.t] || o.t; return D[o.t] ? o : null; }
  function tryJson(t) { try { return JSON.parse(t); } catch (e) { try { return JSON.parse(t.replace(/'/g, '"')); } catch (e2) { return undefined; } } }
  F.parseAll = function (src) {
    var t = String(src || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/?(div|p)[^>]*>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/[“”]/g, '"').trim();
    if (!t) return [];
    var v = tryJson(t);
    if (v === undefined) v = tryJson('[' + t.replace(/\}\s*[,、\n]?\s*\{/g, '},{') + ']');
    if (v === undefined) return [];
    return (Array.isArray(v) ? v : [v]).map(one).filter(Boolean);
  };
  F.parse = function (src) { return F.parseAll(src)[0] || null; };
  F.draw = function (box, src) {
    var list = typeof src === 'string' ? F.parseAll(src) : (Array.isArray(src) ? src.map(one).filter(Boolean) : [one(src)].filter(Boolean));
    if (!box || !list.length) return false;
    box.innerHTML = '';
    var made = 0;
    list.forEach(function (o) {
      try { var s = D[o.t](o); var w = document.createElement('div'); w.className = 'fg-one'; w.appendChild(s); box.appendChild(w); made++; } catch (e) {}
    });
    if (!made) return false;
    box.classList.toggle('fg-many', made > 1);
    box.hidden = false; return true;
  };
  F.types = D;
})();

/* 図の見た目（CSS）もここから入れる */
(function () {
  var css = "/* ===== 図の型（FIG） ===== */\n.fg { margin: 16px auto 0; max-width: 380px; background: var(--fg-bg, #f1f3f6); border-radius: 12px; padding: 8px; box-sizing: border-box; }\n.fg[hidden] { display: none; }\n.fg svg { display: block; max-width: 100%; height: auto; margin: 0 auto; overflow: visible; }\n.fg .axis { stroke: #8a9099; stroke-width: 1.2; }\n.fg .ahd { fill: #8a9099; } .fg .ahk { fill: #c9821a; } .fg .ahf { fill: #2b4f8c; }\n.fg .shape { stroke: #2b4f8c; stroke-width: 1.7; fill: none; stroke-linejoin: round; }\n.fg .shape.fill { fill: #dfe7f4; }\n.fg .main { stroke: #2b4f8c; stroke-width: 2; fill: none; }\n.fg .curve { stroke: #2b4f8c; stroke-width: 2.2; fill: none; stroke-linejoin: round; }\n.fg .guide { stroke: #8a9099; stroke-width: 1.2; stroke-dasharray: 4 4; fill: none; }\n.fg .key { stroke: #c9821a; stroke-width: 4.5; stroke-linecap: round; fill: none; }\n.fg .key.thin { stroke-width: 2.5; }\n.fg .ang { stroke: #22252b; stroke-width: 1.3; fill: none; }\n.fg .dot { fill: #2b4f8c; } .fg .key-dot { fill: #c9821a; }\n.fg .odot { fill: #fff; stroke: #c9821a; stroke-width: 2.2; }\n.fg .lb { font-family: inherit; font-size: 13px; fill: #22252b; paint-order: stroke; stroke: var(--fg-bg, #f1f3f6); stroke-width: 4px; stroke-linejoin: round; }\n.fg .lb.sub { fill: #5d636c; }\n.fg .lb.tick { font-size: 11px; fill: #70757d; }\n.fg .lb.var { font-family: \"Times New Roman\", \"STIX Two Text\", serif; font-style: italic; font-size: 16px; }\n.fg .lb.key-t { fill: #b0700f; font-weight: 700; }\n.fg .lb.key-t.var { font-weight: 400; font-size: 17px; }\n.fg .lb.vec-t { fill: #2b4f8c; font-family: \"Times New Roman\", serif; font-style: italic; font-size: 16px; font-weight: 700; }\n.fg .lb.ang-t { font-size: 13px; }\n.fg .lb.sm { font-size: 11.5px; }\n.fg .lb.key-t.sm { font-size: 12px; }\n.fg .lb.note { font-size: 12.5px; fill: #3b4048; }\n.fg .lb.note.key-n { fill: #8a5a12; }\n.fg .fg-one { min-width: 0; }\n.fg.fg-many { display: flex; flex-direction: column; gap: 10px; }\n.fg.fg-many .fg-one + .fg-one { border-top: 1px dashed #d3d8df; padding-top: 10px; }\n.fg .key2 { stroke: #2b4f8c; stroke-width: 4.5; stroke-linecap: round; fill: none; opacity: .55; }\n.fg .lb.k2-t { fill: #2b4f8c; font-weight: 700; }\n.fg .lb.k2-t.sm { font-size: 12px; }\n";
  var st = document.getElementById('fgcss');
  if (!st) { st = document.createElement('style'); st.id = 'fgcss'; (document.head || document.documentElement).appendChild(st); }
  st.textContent = css;
})();
