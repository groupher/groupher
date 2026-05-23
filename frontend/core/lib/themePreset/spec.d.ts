import type { TResolvedThemePreset } from '~/spec'

// Theme token keys that can be passed as the light/base side of an `xx / xxDark`
// pair. Example: `textTitle` is valid; `textTitleDark` is derived internally.
export type TThemePresetBaseField = Exclude<
  Extract<keyof TResolvedThemePreset, string>,
  `${string}Dark`
>

// CSS custom properties emitted by the theme preset runtime helpers.
export type TThemePresetCssVars = Record<`--${string}`, string>
