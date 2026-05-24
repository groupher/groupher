import THEME, { LOCAL_THEME_KEY, THEME_MODE } from '~/const/theme'
import { buildThemePresetCssVars } from '~/lib/themePreset'
import type { TParseDashboard, TResolvedThemePreset } from '~/spec'

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

const sanitizeCSSVars = (vars: TCSSVarMap): TCSSVarMap => {
  const sanitized: TCSSVarMap = {}

  for (const [key, value] of Object.entries(vars)) {
    // SSR writes these values into a raw <style> tag. Keep this as an
    // injection-boundary guard only; preset resolution still belongs to the
    // backend and is not repeated on the client.
    if (HEX_COLOR_RE.test(value)) {
      sanitized[key] = value
    }
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
  if (!dashboard.themeTokens?.primaryColor) return []

  const themeTokens = dashboard.themeTokens as TResolvedThemePreset
  const lightVars = buildThemePresetCssVars(themeTokens, THEME.LIGHT)
  const darkVars = buildThemePresetCssVars(themeTokens, THEME.DARK)

  return [
    [':root', sanitizeCSSVars(lightVars)],
    ["[data-theme='dark']", sanitizeCSSVars(darkVars)],
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
