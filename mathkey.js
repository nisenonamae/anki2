/* Anki2：Mathkey カードの動きの直し（カードが読みこむ。ここを直せばノートタイプは貼り直さなくてよい） */
(function () {
  if (window.MKEXT && window.MKEXT.v >= 1) return;
  var E = window.MKEXT = { v: 1 };
  /* 長い式が枠からはみ出すときは、式の文字を小さくして枠に収める（小さくしすぎない） */
  E.fitMath = function () {
    var boxes = document.querySelectorAll('.mkn .mk-hero .mk-formula, .mkn .mk-formsm .mk-formula');
    Array.prototype.forEach.call(boxes, function (b) {
      if (!b.querySelector('mjx-container')) return;
      b.style.fontSize = '';
      var base = parseFloat(getComputedStyle(b).fontSize) || 20, wrap = b.parentNode ? b.parentNode.clientWidth : 0;
      var room = Math.min(b.clientWidth || wrap, wrap || b.clientWidth), need = b.scrollWidth;
      if (room > 0 && need > room + 1) b.style.fontSize = Math.max(11, Math.floor(base * room / need * 0.97 * 10) / 10) + 'px';
    });
    if (window.fit) try { fit(); } catch (e) {}
  };
  var t = null;
  function soon() { clearTimeout(t); t = setTimeout(E.fitMath, 120); }
  try { new MutationObserver(function (ms) { for (var i = 0; i < ms.length; i++) if (ms[i].addedNodes && ms[i].addedNodes.length) { soon(); return; } }).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
  window.addEventListener('resize', soon);
  soon();
})();
