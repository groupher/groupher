import type { TResolvedThemePreset } from '~/lib/themePreset'
import type { TThemePreset } from '~/spec'
import type { TDsbFieldMap } from '~/stores/dashboard/spec'
import type { TPageBgDraft } from '~/widgets/CustomPageBg/hooks'

export type TThemePresetOption = {
  value: TThemePreset
  overwrite: TResolvedThemePreset
}

export type TThemePresetCardMode = 'stacked' | 'forkActive' | 'forkBase'

export type TThemePresetOverwrite = TResolvedThemePreset

export type TThemeDetails = {
  selectedOverwrite: TThemePresetOverwrite
  selectedPageBgDraft: TPageBgDraft
  primaryColor: string
  accentColor: string
  isLightTheme: boolean
  pageBgResetKey: string
  onPageBgPreview: (patch: Partial<TPageBgDraft>) => void
  onPageBgCommit: (patch: Partial<TPageBgDraft>) => void
  onThemePresetPreview: (patch: Partial<TThemePresetOverwrite>) => void
  onThemePresetSchedule: (patch: Partial<TThemePresetOverwrite>) => void
  onThemePresetFlush: () => void
  onThemePresetCommit: (patch: Partial<TThemePresetOverwrite>) => void
}

export type TEditDashboardField = <K extends keyof TDsbFieldMap>(
  field: K,
  value: TDsbFieldMap[K],
) => void
