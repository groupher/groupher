import { getDefaultCustomColor } from '~/const/colors'
import THEME, { LOCAL_THEME_KEY, THEME_MODE } from '~/const/theme'
import { DEFAULT_TEXT_DIGEST, DEFAULT_TEXT_TITLE } from '~/const/theme_preset'
import { resolveThemePreset, resolveThemePresetPageBgCssVar } from '~/lib/themePreset'
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

// Build first-paint dashboard color variables on the server so custom colors do
// not wait for client hydration to override the base token defaults.
const resolveDsbColorVars = (dashboard: Partial<TParseDashboard>): Array<[string, TCSSVarMap]> => {
  const themePreset = resolveThemePreset(dashboard)

  return [
    [
      ':root',
      {
        '--color-primary-custom': resolveSafeColor(themePreset.primaryCustomColor, THEME.LIGHT),
        '--color-primary-custom-dark': resolveSafeColor(
          themePreset.primaryCustomColorDark,
          THEME.DARK,
        ),
        '--color-accent-custom': resolveSafeColor(themePreset.accentCustomColor, THEME.LIGHT),
        '--color-accent-custom-dark': resolveSafeColor(
          themePreset.accentCustomColorDark,
          THEME.DARK,
        ),
        '--color-title': resolveSafeColor(themePreset.textTitle, THEME.LIGHT, DEFAULT_TEXT_TITLE),
        '--color-digest': resolveSafeColor(
          themePreset.textDigest,
          THEME.LIGHT,
          DEFAULT_TEXT_DIGEST,
        ),
        '--color-page-custom': resolveThemePresetPageBgCssVar(
          THEME.LIGHT,
          themePreset.pageBg,
          themePreset.pageCustomBg,
          themePreset.pageCustomIntensity,
        ),
        '--color-page-custom-dark': resolveThemePresetPageBgCssVar(
          THEME.DARK,
          themePreset.pageBgDark,
          themePreset.pageCustomBgDark,
          themePreset.pageCustomIntensityDark,
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
