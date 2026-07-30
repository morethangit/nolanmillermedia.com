/* nolanmillermedia.com — cues.
 *
 * Deliberately tiny and dependency-free. Everything here is an enhancement:
 * with JS disabled the `js` class never lands, every reveal stays visible, and
 * the blackout overlay stays display:none. Nothing here is load-bearing.
 */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Nav: hairline + backdrop once we're off the hero. rAF-throttled, passive. */
  var nav = document.querySelector('.nav');
  if (nav) {
    var ticking = false;
    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        nav.classList.toggle('is-stuck', window.scrollY > 40);
        ticking = false;
      });
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* Scroll reveal — bring each section up like a fader. */
  var targets = document.querySelectorAll('.reveal');
  if (!targets.length) return;

  if (reduced || !('IntersectionObserver' in window)) {
    targets.forEach(function (el) { el.classList.add('is-lit'); });
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-lit');
      io.unobserve(entry.target);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

  targets.forEach(function (el) { io.observe(el); });
})();
