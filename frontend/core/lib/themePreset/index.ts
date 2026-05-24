import THEME from '~/const/theme'
import { PRESET_FIELD } from '~/const/theme_preset'
import { createThemeKeyPicker } from '~/lib/themeKey'
import type { TResolvedThemePreset } from '~/spec'

import type { TThemePresetBaseField, TThemePresetCssVars } from './spec'

/**
 * Read a theme token by base key using the `xx / xxDark` naming convention.
 *
 * Problem scenario: callers should pass `PRESET_FIELD.TEXT_TITLE` once and let
 * the current theme decide whether `textTitle` or `textTitleDark` is read.
 *
 * Input:
 *   - `tokens`: resolved theme tokens from the backend.
 *   - `baseKey`: the light/base token key, never the `Dark` key.
 *   - `theme`: the theme to read for.
 *
 * Output:
 *   The token value at `baseKey` for light theme or `${baseKey}Dark` for dark
 *   theme.
 *
 * Example:
 *   getThemePresetValue(tokens, PRESET_FIELD.TEXT_TITLE, THEME.DARK)
 *   // => tokens.textTitleDark
 */
export const getThemePresetValue = <TKey extends TThemePresetBaseField>(
  tokens: TResolvedThemePreset,
  baseKey: TKey,
  theme: typeof THEME.LIGHT | typeof THEME.DARK,
): TResolvedThemePreset[TKey] => createThemeKeyPicker(theme).value(tokens, baseKey) as never

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
 *   buildThemePresetCssVars(tokens, THEME.DARK)['--color-title']
 *   // => tokens.textTitleDark
 */
export const buildThemePresetCssVars = (
  tokens: TResolvedThemePreset,
  theme: typeof THEME.LIGHT | typeof THEME.DARK,
): TThemePresetCssVars => ({
  '--color-primary-custom': getThemePresetValue(tokens, PRESET_FIELD.PRIMARY_COLOR, THEME.LIGHT),
  '--color-primary-custom-dark': getThemePresetValue(
    tokens,
    PRESET_FIELD.PRIMARY_COLOR,
    THEME.DARK,
  ),
  '--color-accent-custom': getThemePresetValue(tokens, PRESET_FIELD.ACCENT_COLOR, THEME.LIGHT),
  '--color-accent-custom-dark': getThemePresetValue(tokens, PRESET_FIELD.ACCENT_COLOR, THEME.DARK),
  '--color-page-custom': getThemePresetValue(tokens, PRESET_FIELD.PAGE_BG, THEME.LIGHT),
  '--color-page-custom-dark': getThemePresetValue(tokens, PRESET_FIELD.PAGE_BG, THEME.DARK),
  '--color-title': getThemePresetValue(tokens, PRESET_FIELD.TEXT_TITLE, theme),
  '--color-title-dark': getThemePresetValue(tokens, PRESET_FIELD.TEXT_TITLE, THEME.DARK),
  '--color-digest': getThemePresetValue(tokens, PRESET_FIELD.TEXT_DIGEST, theme),
  '--color-digest-dark': getThemePresetValue(tokens, PRESET_FIELD.TEXT_DIGEST, THEME.DARK),
  '--color-card': getThemePresetValue(tokens, PRESET_FIELD.CARD_COLOR, theme),
  '--color-card-dark': getThemePresetValue(tokens, PRESET_FIELD.CARD_COLOR, THEME.DARK),
  '--color-divider': getThemePresetValue(tokens, PRESET_FIELD.DIVIDER_COLOR, theme),
  '--color-divider-dark': getThemePresetValue(tokens, PRESET_FIELD.DIVIDER_COLOR, THEME.DARK),
})
