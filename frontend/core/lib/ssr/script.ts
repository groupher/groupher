import THEME, { LOCAL_THEME_KEY, THEME_MODE } from '~/const/theme'
import { DEFAULT_TEXT_DIGEST, DEFAULT_TEXT_TITLE } from '~/const/theme_preset'
import {
  resolveThemePreset,
  resolveThemePresetColor,
  resolveThemePresetPageBgCssVar,
} from '~/lib/themePreset'
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
const serializeCSSVars = (selector: string, vars: TCSSVarMap): string => {
  const entries = Object.entries(vars)

  if (entries.length === 0) return ''

  const body = entries.map(([key, value]) => `  ${key}: ${value};`).join('\n')
  return `${selector} {\n${body}\n}`
}

// Build first-paint dashboard color variables on the server so custom colors do
// not wait for client hydration to override the base token defaults.
const resolveDsbColorVars = (dashboard: Partial<TParseDashboard>): Array<[string, TCSSVarMap]> => {
  const themePreset = resolveThemePreset(dashboard)

  return [
    [
      ':root',
      {
        '--color-primary-custom': resolveThemePresetColor(themePreset.primaryColor, '#333333'),
        '--color-primary-custom-dark': resolveThemePresetColor(
          themePreset.primaryColorDark,
          '#ffffff',
        ),
        '--color-accent-custom': resolveThemePresetColor(themePreset.accentColor, '#333333'),
        '--color-accent-custom-dark': resolveThemePresetColor(
          themePreset.accentColorDark,
          '#ffffff',
        ),
        '--color-title': resolveThemePresetColor(themePreset.textTitle, DEFAULT_TEXT_TITLE),
        '--color-digest': resolveThemePresetColor(themePreset.textDigest, DEFAULT_TEXT_DIGEST),
        '--color-page-custom': resolveThemePresetPageBgCssVar(THEME.LIGHT, themePreset.pageBg),
        '--color-page-custom-dark': resolveThemePresetPageBgCssVar(
          THEME.DARK,
          themePreset.pageBgDark,
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
