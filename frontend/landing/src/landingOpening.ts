export const LANDING_OPENING_SCROLL_KEY = 'groupher:landing-opening-scroll-y:v1'
export const LANDING_OPENING_WIDTH_VAR = '--landing-opening-width'
export const LANDING_OPENING_END = 1200

// Keep these values aligned with the Landing container tokens and CSS animation range.
const LANDING_WIDE_BREAKPOINT = 1680
const LANDING_DEFAULT_WIDTH = 1425
const LANDING_WIDE_WIDTH = 1520

/** Interpolates the opening container width from the viewport to its desktop limit during scroll. */
export const getLandingOpeningWidth = (viewportWidth: number, scrollTop: number): number => {
  const limit =
    viewportWidth >= LANDING_WIDE_BREAKPOINT ? LANDING_WIDE_WIDTH : LANDING_DEFAULT_WIDTH
  const toWidth = Math.min(limit, viewportWidth)
  const progress = Math.min(1, Math.max(0, scrollTop / LANDING_OPENING_END))

  return viewportWidth + (toWidth - viewportWidth) * progress
}

/** Seeds the visual width before paint using the restored position, then checks the live scroll. */
export const prePaintLandingOpeningScript = `
(function() {
  try {
    var key = ${JSON.stringify(LANDING_OPENING_SCROLL_KEY)} + window.location.pathname;
    var restoredY = 0;
    var navigation = window.performance.getEntriesByType('navigation')[0];
    if (navigation && (navigation.type === 'reload' || navigation.type === 'back_forward')) {
      try {
        var savedY = window.sessionStorage.getItem(key);
        if (savedY !== null) {
          restoredY = Number(savedY);
        } else {
          var routeKey = window.history.state && window.history.state.__TSR_key;
          var routerPositions = window.sessionStorage.getItem('tsr-scroll-restoration-v1_3');
          if (routeKey && routerPositions) {
            restoredY = JSON.parse(routerPositions)[routeKey]?.window?.scrollY ?? 0;
          }
        }
      } catch (error) {}
    }
    var paint = function(scrollTop) {
      var viewport = window.innerWidth;
      var limit = viewport >= ${LANDING_WIDE_BREAKPOINT} ? ${LANDING_WIDE_WIDTH} : ${LANDING_DEFAULT_WIDTH};
      var progress = Math.min(1, Math.max(0, (Number(scrollTop) || 0) / ${LANDING_OPENING_END}));
      var width = viewport + (Math.min(limit, viewport) - viewport) * progress;
      document.documentElement.style.setProperty(${JSON.stringify(LANDING_OPENING_WIDTH_VAR)}, width + 'px');
    };
    paint(restoredY);
    document.documentElement.setAttribute('data-landing-opening-ready', 'true');
    window.requestAnimationFrame(function() { paint(window.scrollY); });
  } catch (error) {}
})();
`
