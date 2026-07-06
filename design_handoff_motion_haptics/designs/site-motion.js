/* Arcaevo site motion — subtle scroll-reveal + chart draw-in.
   Usage: load in <helmet>. Mark elements with:
     data-reveal            → fades/rises in when scrolled into view (below-fold only)
     data-reveal-delay="90" → optional stagger in ms
     data-draw              → on an SVG polyline/path: draws the line in on reveal
   Respects prefers-reduced-motion. Elements above the fold on first paint are left static. */
(function () {
  if (window.__arcaevoMotion) return;
  window.__arcaevoMotion = true;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  var EASE = 'cubic-bezier(0.22,1,0.36,1)';

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      var el = en.target;
      var d = parseFloat(el.getAttribute('data-reveal-delay') || '0');
      setTimeout(function () {
        if (el.__isDraw) {
          el.style.strokeDashoffset = '0';
        } else {
          el.style.opacity = '1';
          el.style.transform = 'none';
        }
      }, d);
    });
  }, { rootMargin: '0px 0px -7% 0px', threshold: 0.06 });

  function inFirstView(el) {
    var r = el.getBoundingClientRect();
    return r.top < window.innerHeight * 0.95 && window.scrollY < 40;
  }

  function prepReveal(el) {
    if (el.__motionPrepped) return;
    el.__motionPrepped = true;
    if (inFirstView(el)) return; // above the fold: stay static, no flash
    el.style.opacity = '0';
    el.style.transform = 'translateY(16px)';
    el.style.transition = 'opacity 0.75s ' + EASE + ', transform 0.75s ' + EASE;
    io.observe(el);
  }

  function prepDraw(el) {
    if (el.__motionPrepped) return;
    el.__motionPrepped = true;
    el.__isDraw = true;
    if (inFirstView(el)) return;
    el.setAttribute('pathLength', '100');
    el.style.strokeDasharray = '100';
    el.style.strokeDashoffset = '100';
    el.style.transition = 'stroke-dashoffset 1.2s ' + EASE;
    io.observe(el);
  }

  function scan(root) {
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    if (root.querySelectorAll) {
      root.querySelectorAll('[data-reveal]').forEach(prepReveal);
      root.querySelectorAll('[data-draw]').forEach(prepDraw);
    }
    if (root.nodeType === 1 && root.hasAttribute) {
      if (root.hasAttribute('data-reveal')) prepReveal(root);
      if (root.hasAttribute('data-draw')) prepDraw(root);
    }
  }

  scan(document);
  new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var added = muts[i].addedNodes;
      for (var j = 0; j < added.length; j++) scan(added[j]);
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
