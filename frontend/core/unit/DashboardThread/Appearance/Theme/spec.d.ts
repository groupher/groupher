import type { TResolvedThemePreset } from '~/lib/themePreset'
import type { TThemePreset } from '~/spec'
import type { TDsbFieldMap } from '~/stores/dashboard/spec'

export type TThemePresetOption = {
  value: TThemePreset
  overwrite: TResolvedThemePreset
}

export type TThemePresetCardMode = 'stacked' | 'forkActive' | 'forkBase'

export type TThemePresetOverwrite = TResolvedThemePreset

export type TEditDashboardField = <K extends keyof TDsbFieldMap>(
  field: K,
  value: TDsbFieldMap[K],
) => void
