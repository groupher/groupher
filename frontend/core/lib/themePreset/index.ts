import THEME from '~/const/theme'
import type { TResolvedThemePreset, TThemePresetThemeTokens } from '~/spec'

import type { TThemePresetCssVars } from './spec'

type TThemeName = typeof THEME.LIGHT | typeof THEME.DARK

export const getThemePresetSection = (
  tokens: TResolvedThemePreset,
  theme: TThemeName,
): TThemePresetThemeTokens => (theme === THEME.DARK ? tokens.dark : tokens.light)

/**
 * Return the CSS variable that already carries the resolved page background.
 *
 * Problem scenario: the backend owns preset tokens, but the first client render
 * can briefly see an empty token store before hydration. In that gap, callers
 * should fall back to the CSS variable injected by SSR/ThemePresetScope instead
 * of hard-coding preset colors in frontend code.
 *
 * Example:
 *   getThemePresetPageBgCssVar(THEME.DARK)
 *   // => 'var(--color-page-custom-dark)'
 */
export const getThemePresetPageBgCssVar = (theme: typeof THEME.LIGHT | typeof THEME.DARK): string =>
  theme === THEME.DARK ? 'var(--color-page-custom-dark)' : 'var(--color-page-custom)'

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
 *   A CSS variable map for that theme. The primary/accent/page companion
 *   `*-dark` variables are emitted together because existing CSS tokens read
 *   those variables directly inside dark selectors.
 *
 * Example:
 *   composeThemePresetCssVars(tokens, THEME.DARK)['--color-title']
 *   // => tokens.dark.textTitle
 */
export const composeThemePresetCssVars = (
  tokens: TResolvedThemePreset,
  theme: typeof THEME.LIGHT | typeof THEME.DARK,
): TThemePresetCssVars => {
  const active = getThemePresetSection(tokens, theme)

  return {
    '--color-primary-custom': tokens.light.primaryColor,
    '--color-primary-custom-dark': tokens.dark.primaryColor,
    '--color-accent-custom': tokens.light.accentColor,
    '--color-accent-custom-dark': tokens.dark.accentColor,
    '--color-page-custom': tokens.light.pageBg,
    '--color-page-custom-dark': tokens.dark.pageBg,
    '--color-title': active.textTitle,
    '--color-title-dark': tokens.dark.textTitle,
    '--color-digest': active.textDigest,
    '--color-digest-dark': tokens.dark.textDigest,
    '--color-card': active.cardColor,
    '--color-card-dark': tokens.dark.cardColor,
    '--color-divider': active.dividerColor,
    '--color-divider-dark': tokens.dark.dividerColor,
  }
}
