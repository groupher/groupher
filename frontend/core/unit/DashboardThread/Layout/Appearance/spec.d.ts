import type { THEME_PRESET_OPTIONS } from '~/const/theme_preset'
import type { TResolvedThemePreset } from '~/lib/themePreset'
import type { TDsbFieldMap } from '~/stores/dashboard/spec'

export type TThemePresetOption = (typeof THEME_PRESET_OPTIONS)[number]

export type TThemePresetOverrides = TResolvedThemePreset

export type TEditDashboardField = <K extends keyof TDsbFieldMap>(
  field: K,
  value: TDsbFieldMap[K],
) => void
