import { LANDING_OPENING_SCROLL_KEY } from './landingOpening'

export const LANDING_COVER_RANGE_KEY = 'groupher:landing-cover-scroll-range:v1'
export const LANDING_COVER_EXIT_CLEARANCE = 64

/** Paint restored cover rails from the saved scroll position before React takes over. */
export const prePaintLandingCoverScript = `
(function() {
  try {
    var navigation = window.performance.getEntriesByType('navigation')[0];
    if (!navigation || (navigation.type !== 'reload' && navigation.type !== 'back_forward')) return;

    var root = document.documentElement;
    var scrollKey = ${JSON.stringify(LANDING_OPENING_SCROLL_KEY)} + window.location.pathname;
    var savedY = Number(window.sessionStorage.getItem(scrollKey)) || 0;
    var savedRange = Number(window.sessionStorage.getItem(${JSON.stringify(LANDING_COVER_RANGE_KEY)} + window.location.pathname)) || window.innerHeight;
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    root.setAttribute('data-landing-cover-booting', 'true');
    var frameCount = 0;

    var paint = function() {
      if (!root.hasAttribute('data-landing-cover-booting')) return;
      var gallery = document.querySelector('.cover-scene-gallery');
      if (!gallery && document.readyState !== 'loading') {
        root.removeAttribute('data-landing-cover-booting');
        return;
      }
      var range = gallery
        ? Math.max(gallery.getBoundingClientRect().bottom + window.scrollY - ${LANDING_COVER_EXIT_CLEARANCE}, 1)
        : Math.max(savedRange, 1);
      var scrollTop = window.scrollY || savedY;
      var progress = Math.min(1, Math.max(0, scrollTop / range));

      document.querySelectorAll('.cover-scene-card .cover-scene-rail').forEach(function(rail) {
        var id = rail.getAttribute('data-scene-id');
        if (!id) return;
        var fadeStart = Number(rail.getAttribute('data-cover-fade-start'));
        var fadeEnd = Number(rail.getAttribute('data-cover-fade-end'));
        var travel = Number(rail.getAttribute('data-cover-travel'));
        var movementStart = Number(rail.getAttribute('data-cover-movement-start'));
        var panDistance = Number(rail.getAttribute('data-cover-pan-distance'));
        var opacity = Math.min(1, Math.max(0, (fadeEnd - progress) / (fadeEnd - fadeStart)));
        var staggered = Math.max(0, (progress - movementStart) / (1 - movementStart));
        var y = reducedMotion ? 0 : -travel * (0.06 * progress + 0.94 * staggered);
        var pan = reducedMotion ? 0 : panDistance * Math.min(1, progress / fadeEnd);
        root.style.setProperty('--landing-cover-boot-opacity-' + id, String(opacity));
        root.style.setProperty('--landing-cover-boot-visibility-' + id, opacity === 0 ? 'hidden' : 'visible');
        root.style.setProperty('--landing-cover-boot-y-' + id, y + 'px');
        root.style.setProperty('--landing-cover-boot-pan-' + id, pan + 'px');
      });

      if (++frameCount < 180) window.requestAnimationFrame(paint);
    };
    window.requestAnimationFrame(paint);
  } catch (error) {}
})();
`
