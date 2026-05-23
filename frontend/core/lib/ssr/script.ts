import THEME, { LOCAL_THEME_KEY, THEME_MODE } from '~/const/theme'
import { buildThemePresetCssVars, getThemeTokens } from '~/lib/themePreset'
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

const sanitizeCSSVars = (vars: TCSSVarMap, fallback: TCSSVarMap): TCSSVarMap => {
  const sanitized: TCSSVarMap = {}

  for (const [key, value] of Object.entries(vars)) {
    // SSR writes these values into a raw <style> tag. Keep this as an
    // injection-boundary guard only; preset resolution still belongs to the
    // backend and is not repeated on the client.
    sanitized[key] = HEX_COLOR_RE.test(value) ? value : fallback[key]
  }

  return sanitized
}

const serializeCSSVars = (selector: string, vars: TCSSVarMap): string => {
  const entries = Object.entries(vars)

  if (entries.length === 0) return ''

  const body = entries.map(([key, value]) => `  ${key}: ${value};`).join('\n')
  return `${selector} {\n${body}\n}`
}

// Build first-paint dashboard color variables on the server so custom colors do
// not wait for client hydration to override the base token defaults.
const resolveDsbColorVars = (dashboard: Partial<TParseDashboard>): Array<[string, TCSSVarMap]> => {
  const themeTokens = getThemeTokens(dashboard.themeTokens)
  const defaultTokens = getThemeTokens()
  const lightVars = buildThemePresetCssVars(themeTokens, THEME.LIGHT)
  const darkVars = buildThemePresetCssVars(themeTokens, THEME.DARK)
  const lightFallback = buildThemePresetCssVars(defaultTokens, THEME.LIGHT)
  const darkFallback = buildThemePresetCssVars(defaultTokens, THEME.DARK)

  return [
    [':root', sanitizeCSSVars(lightVars, lightFallback)],
    ["[data-theme='dark']", sanitizeCSSVars(darkVars, darkFallback)],
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
