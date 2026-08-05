/* nolanmillermedia.com — /studio/ only.
 *
 * Same contract as site.js: nothing here is load-bearing. The split, the
 * invert on hover/focus and the moving seam are all plain CSS. If this file
 * never runs, stage.css's safety-net delay lights the hero on its own and the
 * page is fully usable — it just loses the intro, the beam tracking and the
 * idle cycle.
 *
 * Three jobs:
 *   1. the ready gate — hold the intro until the display font is in, but
 *      never for more than 1200ms
 *   2. the beam follows the pointer
 *   3. on devices that can't hover, the two halves take turns
 */
(function () {
  'use strict';

  var root    = document.documentElement;
  var stage   = document.querySelector('.stage');
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine    = matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (!stage) return;

  var lens = stage.querySelector('.half--lens');
  var room = stage.querySelector('.half--room');


  /* --- 1. Ready ----------------------------------------------------------
   * The strike wipes across the name, so the name has to be set in Archivo
   * before it fires — otherwise it reflows mid-animation. Waiting on the font
   * is the whole "load", and it is capped hard: worst case is a fraction of a
   * second of black, never a spinner and never an indefinite hold.
   */

  var fired = false;
  var cap;

  function ready() {
    if (fired) return;
    fired = true;
    clearTimeout(cap);
    root.classList.add('is-ready');
    if (!fine && !reduced) startCycle();
  }

  cap = setTimeout(ready, 1200);

  if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
    document.fonts.ready.then(ready)['catch'](ready);
  } else {
    ready();
  }


  /* --- 2. The beam follows the pointer ------------------------------------
   * The fan's origin is the lamp, at the top of the right-hand column — about
   * 75% across the viewport. Pointer x either side of that skews the rays, so
   * the light aims at wherever you are. rAF-throttled, passive, and only on a
   * real pointer.
   */

  if (fine && !reduced) {
    var rays = stage.querySelector('.art-rays');

    if (rays) {
      var pending = false;
      var swing = 0;

      var apply = function () {
        pending = false;
        rays.style.setProperty('--swing', swing.toFixed(2) + 'deg');
      };

      stage.addEventListener('pointermove', function (e) {
        var w = window.innerWidth || 1;
        var t = (e.clientX - w * 0.75) / (w * 0.5);   /* 0 at the lamp */
        if (t < -1) t = -1;
        if (t > 1) t = 1;
        swing = t * 9;
        if (pending) return;
        pending = true;
        requestAnimationFrame(apply);
      }, { passive: true });

      stage.addEventListener('pointerleave', function () {
        swing = 0;
        if (pending) return;
        pending = true;
        requestAnimationFrame(apply);
      }, { passive: true });
    }
  }


  /* --- 3. The halves take turns -------------------------------------------
   * A touch screen has no pointer to follow, so the page demonstrates the
   * mechanic itself: the two halves trade the light on a slow cycle, which
   * doubles as an idle attract state. Skipped entirely under reduced motion,
   * where a 4-second hard cut would be a strobe rather than a fade.
   */

  function startCycle() {
    if (!lens || !room) return;

    var lit = 1;   /* first move lights the lens */

    var step = function () {
      lit = lit ? 0 : 1;
      lens.classList.toggle('is-lit', lit === 0);
      room.classList.toggle('is-lit', lit === 1);
      stage.classList.toggle('seam--lens', lit === 0);
      stage.classList.toggle('seam--room', lit === 1);
    };

    setTimeout(function () {
      step();
      setInterval(function () {
        if (document.hidden) return;   /* don't animate a backgrounded tab */
        step();
      }, 4200);
    }, 1400);
  }
})();
