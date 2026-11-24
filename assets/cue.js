/* nolanmillermedia.com — the light engine for the homepage cue stack.
 *
 * Three jobs, all enhancements (without JS the hero is just the photo, lit):
 *   1. The show: scroll position → cue (Q0–Q3) and four continuous levels
 *      (--haze, --open, --lb, --lbh) on .show-stage.
 *   2. The followspot: the pointer (or a finger) is the spot. Left alone, it
 *      wanders on its own like an operator looking for a mark.
 *   3. The gel picker and the floating stills in the two lists.
 *
 * One rAF loop, and it only runs while the show is on screen.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* --- Gels --------------------------------------------------------------- */

  var gelName = document.querySelector('[data-gel-name]');
  var current = root.dataset.gel || 'nc';
  document.querySelectorAll('.gel input').forEach(function (input) {
    if (input.value === current) {
      input.checked = true;
      if (gelName) gelName.textContent = input.value === 'nc' ? 'N/C' : input.nextElementSibling.textContent;
    }
    input.addEventListener('change', function () {
      if (!input.checked) return;
      if (input.value === 'nc') delete root.dataset.gel; else root.dataset.gel = input.value;
      if (gelName) gelName.textContent = input.value === 'nc' ? 'N/C' : input.nextElementSibling.textContent;
      try { localStorage.setItem('nmm-gel', input.value === 'nc' ? '' : input.value); } catch (e) {}
    });
  });

  /* --- Floating stills ------------------------------------------------------ */

  var peek = document.querySelector('.peek');
  if (peek && fine) {
    var peekImg = peek.querySelector('img');
    document.querySelectorAll('[data-preview] .row').forEach(function (row) {
      row.addEventListener('pointerenter', function () {
        peekImg.src = row.dataset.still;
        peek.classList.add('is-on');
      });
      row.addEventListener('pointerleave', function () { peek.classList.remove('is-on'); });
      row.addEventListener('pointermove', function (e) {
        var w = peek.offsetWidth;
        // Sit to the right of the cursor, flip left near the edge.
        var x = e.clientX + 28;
        if (x + w > innerWidth - 16) x = e.clientX - w - 28;
        peek.style.setProperty('--px', x + 'px');
        peek.style.setProperty('--py', (e.clientY - peek.offsetHeight / 2) + 'px');
      });
    });
  }

  /* --- Pull back ----------------------------------------------------------- */

  var mon = document.querySelector('.monitor');
  var monStage = mon && mon.querySelector('.monitor-stage');
  if (mon && monStage) {
    var monQueued = false;
    var monUpdate = function () {
      monQueued = false;
      var total = mon.offsetHeight - innerHeight;
      var q = total > 0 ? Math.min(1, Math.max(0, -mon.getBoundingClientRect().top / total)) : 1;
      var e = function (a, b) { var t = Math.min(1, Math.max(0, (q - a) / (b - a))); return t * t * (3 - 2 * t); };
      monStage.style.setProperty('--zoom', (1.5 - 0.5 * e(0.05, 0.7)).toFixed(4));
      monStage.style.setProperty('--reveal', e(0.55, 0.85).toFixed(3));
    };
    addEventListener('scroll', function () {
      if (!monQueued) { monQueued = true; requestAnimationFrame(monUpdate); }
    }, { passive: true });
    addEventListener('resize', monUpdate, { passive: true });
    monUpdate();
  }

  /* --- The show ------------------------------------------------------------- */

  var show  = document.querySelector('.show');
  var stage = document.querySelector('.show-stage');
  var plate = document.querySelector('.show-plate');
  var lit   = document.querySelector('.plate-lit');
  if (!show || !stage || !plate || !lit) return;

  var elCueNo = stage.querySelector('[data-cue-no]');
  var elLabel = stage.querySelector('[data-cue-label]');
  var elTc    = stage.querySelector('[data-tc]');
  var elInt   = stage.querySelector('[data-int]');
  var LABELS  = ['Lights down', 'Beams', 'Full stage', 'On camera'];

  var W = 0, H = 0, offX = 0, offY = 0;
  function measure() {
    W = stage.clientWidth;
    H = stage.clientHeight;
    offX = (W - plate.offsetWidth) / 2;
    offY = (H - plate.offsetHeight) / 2;
  }
  measure();
  addEventListener('resize', measure, { passive: true });

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function smooth(a, b, x) { var t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  // Spot state, in stage pixels.
  var cx = W * 0.5, cy = H * 0.42, tx = cx, ty = cy;
  var lastInput = -1e9;

  function aim(x, y) {
    var r = stage.getBoundingClientRect();
    tx = x - r.left; ty = y - r.top;
    lastInput = performance.now();
  }
  addEventListener('pointermove', function (e) {
    if (e.pointerType === 'mouse' || e.pointerType === 'pen') aim(e.clientX, e.clientY);
  }, { passive: true });
  // Touch: never preventDefault — the same finger that aims the light also scrolls the show.
  addEventListener('touchstart', function (e) { aim(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  addEventListener('touchmove',  function (e) { aim(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });

  var lastCue = -1, lastTc = '', lastInt = '';
  var t0 = performance.now();

  function frame(now) {
    // 1. Where are we in the show?
    var total = show.offsetHeight - H;
    var p = total > 0 ? clamp01(-show.getBoundingClientRect().top / total) : 0;

    var haze = smooth(0.10, 0.34, p);
    var open = smooth(0.38, 0.62, p);
    var lb   = smooth(0.68, 0.88, p);
    var bar  = Math.max(0, (H - W / 2.39) / 2) * lb;

    var cue = p < 0.14 ? 0 : p < 0.40 ? 1 : p < 0.68 ? 2 : 3;

    stage.style.setProperty('--haze', haze.toFixed(3));
    stage.style.setProperty('--open', open.toFixed(3));
    stage.style.setProperty('--lb',   lb.toFixed(3));
    stage.style.setProperty('--lbh',  bar.toFixed(1) + 'px');

    if (cue !== lastCue) {
      lastCue = cue;
      stage.dataset.cue = cue;
      if (elCueNo) elCueNo.textContent = cue;
      if (elLabel) elLabel.textContent = LABELS[cue];
    }

    var intensity = Math.round(100 * (0.08 + 0.22 * haze + 0.70 * open));
    var intStr = ('00' + intensity).slice(-3);
    if (elInt && intStr !== lastInt) { lastInt = intStr; elInt.textContent = intStr; }

    // 2. The followspot. Idle for 2.5s (or never touched) → it wanders.
    if (!reduced && now - lastInput > 2500) {
      var s = (now - t0) / 1000;
      tx = W * (0.5 + 0.30 * Math.sin(s * 0.33));
      ty = H * (0.44 + 0.17 * Math.sin(s * 0.51 + 1.2));
    }
    var k = reduced ? 1 : 0.09;
    cx += (tx - cx) * k;
    cy += (ty - cy) * k;

    var base = Math.max(110, Math.min(300, Math.min(W, H) * 0.3));
    var radius = base + open * Math.max(W, H) * 1.6;
    lit.style.setProperty('--sx', (cx - offX).toFixed(1) + 'px');
    lit.style.setProperty('--sy', (cy - offY).toFixed(1) + 'px');
    lit.style.setProperty('--sr', radius.toFixed(1) + 'px');

    // 3. Timecode, 24 fps.
    if (elTc) {
      var f = Math.floor((now - t0) / 1000 * 24);
      var tc = pad(Math.floor(f / 86400) % 24) + ':' + pad(Math.floor(f / 1440) % 60) + ':' +
               pad(Math.floor(f / 24) % 60) + ':' + pad(f % 24);
      if (tc !== lastTc) { lastTc = tc; elTc.textContent = tc; }
    }

    if (running) raf = requestAnimationFrame(frame);
  }

  var running = false, raf = 0;
  function start() { if (!running) { running = true; raf = requestAnimationFrame(frame); } }
  function stop()  { running = false; cancelAnimationFrame(raf); }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries[0].isIntersecting ? start() : stop();
    }).observe(show);
  } else {
    start();
  }
  frame(performance.now());
})();
