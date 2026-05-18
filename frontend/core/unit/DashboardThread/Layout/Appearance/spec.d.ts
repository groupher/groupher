import type { THEME_PRESET_OPTIONS } from '~/const/theme_preset'
import type { TColorName } from '~/spec'
import type { TDsbFieldMap } from '~/stores/dashboard/spec'

export type TThemePresetOption = (typeof THEME_PRESET_OPTIONS)[number]

export type TThemePresetOverrides = {
  pageBg: string
  pageBgDark: string
  pageCustomBg: number
  pageCustomBgDark: number
  pageCustomIntensity: number
  pageCustomIntensityDark: number
  primaryColor: TColorName
  primaryCustomColor: string
  primaryCustomColorDark: string
  subPrimaryColor: TColorName
  textTitle: string
  textDigest: string
}

export type TEditDashboardField = <K extends keyof TDsbFieldMap>(
  field: K,
  value: TDsbFieldMap[K],
) => void
