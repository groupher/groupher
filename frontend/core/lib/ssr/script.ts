import { LOCAL_THEME_KEY, THEME_FIRST_PAINT_STYLE_ID, THEME_MODE } from '~/const/theme'
import { THEME_FIRST_PAINT_VAR_NAMES } from '~/const/theme-first-paint.generated'

const serializeForInlineScript = (value: unknown): string =>
  JSON.stringify(value).replace(/</g, '\\u003c')

const withTryCatch = (script: string): string => `
(function() {
  try {
${script}
  } catch (e) {}
})();
`

/** Runs the pre paint theme detect script operation at the frontend shared boundary. */
export const prePaintThemeDetectScript = () =>
  withTryCatch(`    var stored = localStorage.getItem('${LOCAL_THEME_KEY}');
    var theme = '${THEME_MODE.LIGHT}';

    if (stored === '${THEME_MODE.DARK}' || stored === '${THEME_MODE.LIGHT}') {
      theme = stored;
    } else {
      var media = window.matchMedia('(prefers-color-scheme: dark)');
      theme = media.matches ? '${THEME_MODE.DARK}' : '${THEME_MODE.LIGHT}';
    }

    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
`)

/** Runs the pre paint init time operation at the frontend shared boundary. */
export const prePaintInitTime = () =>
  withTryCatch(`    window.__GROUPHER_INITIAL_NOW__ = Date.now();`)

/**
 * Build a hydration-safe first-paint CSS variable snapshot.
 *
 * React may briefly reconcile `<html data-theme>` back to the server default
 * before ThemeMonitor applies the persisted mode. This script freezes computed
 * theme variables for the currently selected theme until ThemeMonitor removes
 * the temporary style.
 */
export const injectThemeFirstPaintVars = (): string => {
  const names = serializeForInlineScript(THEME_FIRST_PAINT_VAR_NAMES)
  const styleId = serializeForInlineScript(THEME_FIRST_PAINT_STYLE_ID)

  return withTryCatch(`    var names = ${names};
    var styleId = ${styleId};
    var root = document.documentElement;
    var style = document.getElementById(styleId);
    var wasDisabled = false;

    if (style) {
      wasDisabled = style.disabled;
      style.disabled = true;
    }

    var computed = getComputedStyle(root);
    var css = ':root{';

    for (var i = 0; i < names.length; i += 1) {
      var name = names[i];
      var value = computed.getPropertyValue(name).trim();

      if (value) {
        css += name + ':' + value + ' !important;';
      }
    }

    css += '}';

    if (style) {
      style.disabled = wasDisabled;
    }

    if (css === ':root{}') {
      if (style) {
        style.remove();
      }
      return;
    }

    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
    }

    if (!style.parentNode) {
      document.head.appendChild(style);
    }

    style.textContent = css;
`)
}

export const THEME_FIRST_PAINT_VARS_SCRIPT = injectThemeFirstPaintVars()
