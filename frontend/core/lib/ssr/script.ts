import { COLOR, getDefaultCustomColor } from '~/const/colors'
import THEME, { LOCAL_THEME_KEY, THEME_MODE } from '~/const/theme'
import { DEFAULT_TEXT_DIGEST, DEFAULT_TEXT_TITLE } from '~/const/theme_preset'
import { getPageBgCustomColor, normalizePageBgHue, normalizePageBgIntensity } from '~/lib/color'
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
  fallback = getDefaultCustomColor(theme),
) => {
  if (value && HEX_COLOR_RE.test(value)) {
    return value
  }

  return fallback
}

const resolveSafePageBg = (
  theme: typeof THEME.LIGHT | typeof THEME.DARK,
  pageBg: string | undefined,
  hue: number | undefined,
  intensity: number | undefined,
) => {
  if (pageBg !== COLOR.CUSTOM) {
    return 'transparent'
  }

  return getPageBgCustomColor(theme, normalizePageBgHue(hue), normalizePageBgIntensity(intensity))
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
        '--color-title': resolveSafeColor(dashboard.textTitle, THEME.LIGHT, DEFAULT_TEXT_TITLE),
        '--color-digest': resolveSafeColor(dashboard.textDigest, THEME.LIGHT, DEFAULT_TEXT_DIGEST),
        '--color-page-custom-light': resolveSafePageBg(
          THEME.LIGHT,
          dashboard.pageBg,
          dashboard.pageCustomBg,
          dashboard.pageCustomIntensity,
        ),
        '--color-page-custom-dark': resolveSafePageBg(
          THEME.DARK,
          dashboard.pageBgDark,
          dashboard.pageCustomBgDark,
          dashboard.pageCustomIntensityDark,
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
