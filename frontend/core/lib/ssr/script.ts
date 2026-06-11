import THEME, { LOCAL_THEME_KEY, THEME_MODE } from '~/const/theme'
import { composeThemePresetCssVars } from '~/lib/themePreset'
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

/**
 * Keep dashboard color variables restricted to hex values before SSR injection.
 *
 * Problem scenario: SSR renders this map into a raw `<style>` tag; any unexpected
 * token value must not leak into CSS without going through another escape path.
 */
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

/**
 * Build first-paint dashboard color variables on the server side.
 *
 * Problem scenario: custom color overrides should be visible immediately on first
 * render, before hydration.
 *
 * Example:
 *   resolveDsbColorVars({ themeTokens: { ... } })
 *   // => [[':root', {'--color-page-custom': '#fff'}], ["[data-theme='dark']", ...]]
 */
const resolveDsbColorVars = (dashboard: Partial<TParseDashboard>): Array<[string, TCSSVarMap]> => {
  if (!dashboard.themeTokens?.light?.primaryColor || !dashboard.themeTokens?.dark?.primaryColor) {
    return []
  }

  const themeTokens = dashboard.themeTokens as TResolvedThemePreset
  const lightVars = composeThemePresetCssVars(themeTokens, THEME.LIGHT)
  const darkVars = composeThemePresetCssVars(themeTokens, THEME.DARK)

  return [
    [':root', sanitizeCSSVars(lightVars)],
    ["[data-theme='dark']", sanitizeCSSVars(darkVars)],
  ]
}

/**
 * Build the first-paint theme CSS string for the dashboard payload.
 *
 * Problem scenario: each app layout consumes dashboard theme tokens differently,
 * but first-paint style generation should stay in one place and match the
 * existing `composeThemePresetCssVars` semantics.
 *
 * Example:
 *   injectDsbColors(dashboard)
 *   // => ':root { --color-page-custom: #fff; }\n[data-theme='dark'] { --color-page-custom-dark: #111; }'
 */
export const injectDsbColors = (dashboard: Partial<TParseDashboard>): string => {
  return resolveDsbColorVars(dashboard)
    .map(([selector, vars]) => serializeCSSVars(selector, vars))
    .filter(Boolean)
    .join('\n')
}
