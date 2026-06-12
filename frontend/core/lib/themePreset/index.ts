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

  return {
    '--color-primary-custom': active.primaryColor,
    '--color-accent-custom': active.accentColor,
    '--color-page-custom': active.pageBg,
    '--color-title': active.textTitle,
    '--color-digest': active.textDigest,
    '--color-card': active.cardColor,
    '--color-divider': active.dividerColor,
  }
}
