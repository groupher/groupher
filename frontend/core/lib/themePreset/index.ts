import type { TResolvedThemePreset } from '~/spec'

import type { TThemePresetCssVars } from './spec'

/**
 * CSS variable that already carries the resolved page background.
 *
 * Problem scenario: the backend owns preset tokens, but the first client render
 * can briefly see an empty token store before hydration. In that gap, callers
 * should fall back to the CSS variable injected by SSR/ThemePresetScope instead
 * of hard-coding preset colors in frontend code.
 *
 * Example:
 *   THEME_PRESET_PAGE_BG_CSS_VAR // 'var(--color-page-custom)'
 */
export const THEME_PRESET_PAGE_BG_CSS_VAR = 'var(--color-page-custom)'

/**
 * Build CSS variables for one concrete theme.
 *
 * Problem scenario: runtime and SSR need to write the same CSS variables from
 * backend-resolved `themeTokens` without knowing how Custom overwrite was
 * stored or merged in the database.
 *
 * Input:
 *   - `tokens`: resolved theme tokens from the backend.
 *   - `theme`: the CSS variable theme to emit.
 *
 * Output:
 *   A CSS variable map for that theme. Preset colors are active-only: `:root`
 *   writes light values and `[data-theme='dark']` writes dark values to the
 *   same CSS variable names.
 *
 * Example:
 *   composeThemePresetCssVars(tokens, 'dark')['--color-title']
 *   // => tokens.dark.textTitle
 */
export const composeThemePresetCssVars = (
  tokens: TResolvedThemePreset,
  theme: 'light' | 'dark',
): TThemePresetCssVars => {
  const active = tokens[theme]
  const pageBgBlur = Number(active.gaussBlur)
  const normalizedPageBgBlur = Number.isNaN(pageBgBlur)
    ? 100
    : Math.min(Math.max(pageBgBlur, 0), 100)
  const pageBg =
    normalizedPageBgBlur === 100
      ? active.pageBg
      : `color-mix(in srgb, ${active.pageBg} ${normalizedPageBgBlur}%, transparent)`

  return {
    '--color-primary-custom': active.primaryColor,
    '--color-accent-custom': active.accentColor,
    '--color-page-custom': active.pageBg,
    '--color-page-custom-bg': pageBg,
    '--color-title': active.textTitle,
    '--color-digest': active.textDigest,
    '--color-card': active.cardColor,
    '--color-divider': active.dividerColor,
  }
}

type TCSSVarMap = Record<string, string>

const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i
const COLOR_MIX_RE =
  /^color-mix\(in srgb, #[0-9a-f]{6} (?:100|[1-9]?\d)(?:\.\d+)?%, transparent\)$/i

const sanitizeCSSVars = (vars: TCSSVarMap): TCSSVarMap => {
  const sanitized: TCSSVarMap = {}

  for (const [key, value] of Object.entries(vars)) {
    if (HEX_COLOR_RE.test(value) || COLOR_MIX_RE.test(value)) {
      sanitized[key] = value
    }
  }

  return sanitized
}

const serializeThemeCssRule = (selector: string, vars: TCSSVarMap): string => {
  const entries = Object.entries(vars)

  if (entries.length === 0) return ''

  const body = entries.map(([key, value]) => `  ${key}: ${value};`).join('\n')
  return `${selector} {\n${body}\n}`
}

const composeCommunityThemePresetCssRules = (
  themeTokens?: Partial<TResolvedThemePreset> | null,
): Array<[string, TCSSVarMap]> => {
  if (!themeTokens?.light?.primaryColor || !themeTokens.dark?.primaryColor) {
    return []
  }

  const resolvedThemeTokens = themeTokens as TResolvedThemePreset
  const lightVars = composeThemePresetCssVars(resolvedThemeTokens, 'light')
  const darkVars = composeThemePresetCssVars(resolvedThemeTokens, 'dark')

  return [
    [':root', sanitizeCSSVars(lightVars)],
    ["[data-theme='dark']", sanitizeCSSVars(darkVars)],
  ]
}

/**
 * Serialize long-lived CSS for the current community's ThemePreset tokens.
 *
 * Problem scenario: SSR and runtime preview both need to write the same global
 * CSS var names from the community's resolved preset/custom theme tokens, while
 * raw `<style>` injection must keep backend-provided values inside a narrow
 * safe-color boundary.
 *
 * Example:
 *   serializeCommunityThemePresetCss(themeTokens)
 *   // => ':root { --color-page-custom: #fff; }\n[data-theme='dark'] { --color-page-custom: #111; }'
 */
export const serializeCommunityThemePresetCss = (
  themeTokens?: Partial<TResolvedThemePreset> | null,
): string => {
  return composeCommunityThemePresetCssRules(themeTokens)
    .map(([selector, vars]) => serializeThemeCssRule(selector, vars))
    .filter(Boolean)
    .join('\n')
}
