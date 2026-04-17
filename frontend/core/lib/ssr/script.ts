import { getDefaultCustomColor } from '~/const/colors'
import THEME, { LOCAL_THEME_KEY, THEME_MODE } from '~/const/theme'
import type { TParseDashboard } from '~/spec'

export const ssrThemeInitScript = () => `
(function() {
  try {
    var stored = localStorage.getItem('${LOCAL_THEME_KEY}');
    
    if (stored === '${THEME_MODE.DARK}' || stored === '${THEME_MODE.LIGHT}') {
      document.documentElement.setAttribute('data-theme', stored);
    } else {
      var media = window.matchMedia('(prefers-color-scheme: dark)');
      document.documentElement.setAttribute(
        'data-theme',
        media.matches ? '${THEME_MODE.DARK}' : '${THEME_MODE.LIGHT}'
      );
    }
  } catch (e) {}
})();
`

type TCSSVarMap = Record<string, string>
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i

const serializeCSSVars = (selector: string, vars: TCSSVarMap): string => {
  const entries = Object.entries(vars)

  if (entries.length === 0) return ''

  const body = entries.map(([key, value]) => `  ${key}: ${value};`).join('\n')
  return `${selector} {\n${body}\n}`
}

const resolveSafeColor = (
  value: string | undefined,
  theme: typeof THEME.LIGHT | typeof THEME.DARK,
) => {
  if (value && HEX_COLOR_RE.test(value)) {
    return value
  }

  return getDefaultCustomColor(theme)
}

// Build first-paint dashboard color variables on the server so custom colors do
// not wait for client hydration to override the base token defaults.
const resolveDsbColorVars = (dashboard: Partial<TParseDashboard>): Array<[string, TCSSVarMap]> => {
  return [
    [
      ':root',
      {
        '--color-primary-custom': resolveSafeColor(dashboard.primaryCustomColor, THEME.LIGHT),
        '--color-primary-custom-dark': resolveSafeColor(
          dashboard.primaryCustomColorDark,
          THEME.DARK,
        ),
        '--color-sub-primary-custom': resolveSafeColor(
          dashboard.subPrimaryCustomColor,
          THEME.LIGHT,
        ),
        '--color-sub-primary-custom-dark': resolveSafeColor(
          dashboard.subPrimaryCustomColorDark,
          THEME.DARK,
        ),
      },
    ],
  ]
}

// Keep the public API dashboard-shaped so new color tokens can be added in one
// place without changing every app layout that needs first-paint SSR colors.
// Values are sanitized here because the result is injected into a raw <style>
// tag during SSR and must stay within a strict CSS color shape.
export const injectDsbColors = (dashboard: Partial<TParseDashboard>): string => {
  return resolveDsbColorVars(dashboard)
    .map(([selector, vars]) => serializeCSSVars(selector, vars))
    .filter(Boolean)
    .join('\n')
}
