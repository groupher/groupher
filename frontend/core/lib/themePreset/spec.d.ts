import type { TResolvedThemePreset } from '~/spec'

type TThemePresetField = Extract<keyof TResolvedThemePreset, string>

// Theme token keys that can be passed as the light/base side of a real
// `xx / xxDark` pair. Example: `textTitle` is valid because `textTitleDark`
// exists; `glowFixed` is not valid because there is no `glowFixedDark`.
export type TThemePresetBaseField = {
  [TKey in TThemePresetField]: TKey extends `${string}Dark`
    ? never
    : `${TKey}Dark` extends TThemePresetField
      ? TKey
      : never
}[TThemePresetField]

// CSS custom properties emitted by the theme preset runtime helpers.
export type TThemePresetCssVars = Record<`--${string}`, string>
