import THEME from '~/const/theme'
import { DEFAULT_THEME_PRESET_TOKENS, PRESET_FIELD } from '~/const/theme_preset'
import { createThemeKeyPicker } from '~/lib/themeKey'
import type { TResolvedThemePreset } from '~/spec'

import type { TThemePresetBaseField, TThemePresetCssVars } from './spec'

const DEFAULT_RESOLVED_THEME_PRESET = DEFAULT_THEME_PRESET_TOKENS as TResolvedThemePreset

/**
 * Return the theme tokens the frontend should render with.
 *
 * The backend owns preset resolution: built-in preset defaults, custom base
 * preset merging, and custom overwrite merging all happen before `themeTokens`
 * reaches the client. This function only provides a local default for initial
 * render, tests, mocks, or SSR paths where the payload is absent.
 *
 * Example:
 *   getThemeTokens({ textTitle: '#111111' }).textTitle
 *   // => '#111111'
 *
 *   getThemeTokens().textTitle
 *   // => DEFAULT_THEME_PRESET_TOKENS.textTitle
 */
export const getThemeTokens = (
  themeTokens: Partial<TResolvedThemePreset> | null | undefined = undefined,
): TResolvedThemePreset => ({
  ...DEFAULT_RESOLVED_THEME_PRESET,
  ...themeTokens,
})

/**
 * Read a theme token by base key using the `xx / xxDark` naming convention.
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
 *   getThemePresetValue(tokens, 'textTitle', THEME.DARK)
 *   // => tokens.textTitleDark
 */
export const getThemePresetValue = <TKey extends TThemePresetBaseField>(
  tokens: TResolvedThemePreset,
  baseKey: TKey,
  theme: typeof THEME.LIGHT | typeof THEME.DARK,
): TResolvedThemePreset[TKey] => createThemeKeyPicker(theme).value(tokens, baseKey) as never

/**
 * Build CSS variables for one concrete theme.
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
