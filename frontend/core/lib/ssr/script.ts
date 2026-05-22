import { LOCAL_THEME_KEY, THEME_MODE } from '~/const/theme'
import {
  buildThemePresetCssVars,
  buildThemePresetDarkCssVars,
  resolveThemePreset,
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
    [':root', buildThemePresetCssVars(themePreset, true)],
    ["[data-theme='dark']", buildThemePresetDarkCssVars(themePreset)],
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
