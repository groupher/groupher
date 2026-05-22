import type { THEME_PRESET } from '~/const/theme_preset'
import type { TResolvedThemePreset } from '~/lib/themePreset'
import type { TConstValues } from '~/spec'

export type TThemePreset = TConstValues<typeof THEME_PRESET>

export type TThemePresetOption = {
  value: TThemePreset
  overwrite: TResolvedThemePreset
}

export type TThemePresetsQuery = {
  themePresets: Array<{
    value: TThemePreset
    tokens: TResolvedThemePreset
  }>
}
