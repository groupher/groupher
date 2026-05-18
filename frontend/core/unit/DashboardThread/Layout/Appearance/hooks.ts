import { useMemo } from 'react'

import { THEME_PRESET_OPTIONS } from '~/const/theme_preset'
import { blurRGB } from '~/fmt'
import useGaussBlur from '~/hooks/useGaussBlur'
import useLocalDraft from '~/hooks/useLocalDraft'
import useMainBackgroundPreview from '~/hooks/useMainBackgroundPreview'
import useTheme from '~/hooks/useTheme'
import useDashboard from '~/stores/dashboard/hooks'

import { FIELD } from '../../constant'
import useHelper from '../../logic/useHelper'
import { resolveRawBg, type TPageBgDraft } from '../PageBackground/hooks'
import type { TThemePresetOption, TThemePresetOverrides } from './spec'

const APPEARANCE_STORE_FIELDS = [
  FIELD.THEME_PRESET,
  FIELD.THEME_OVERRIDES,
  FIELD.PAGE_BG,
  FIELD.PAGE_BG_DARK,
  FIELD.PRIMARY_COLOR,
  FIELD.PRIMARY_CUSTOM_COLOR,
  FIELD.PRIMARY_CUSTOM_COLOR_DARK,
  FIELD.SUB_PRIMARY_COLOR,
  FIELD.TEXT_TITLE,
  FIELD.TEXT_DIGEST,
  FIELD.PAGE_CUSTOM_BG,
  FIELD.PAGE_CUSTOM_BG_DARK,
  FIELD.PAGE_CUSTOM_INTENSITY,
  FIELD.PAGE_CUSTOM_INTENSITY_DARK,
] as const

const toPageBgDraft = (overrides: TThemePresetOverrides): TPageBgDraft => ({
  pageBg: overrides.pageBg,
  pageBgDark: overrides.pageBgDark,
  pageCustomBg: overrides.pageCustomBg,
  pageCustomBgDark: overrides.pageCustomBgDark,
  pageCustomIntensity: overrides.pageCustomIntensity,
  pageCustomIntensityDark: overrides.pageCustomIntensityDark,
})

export default function useAppearance() {
  const dsb$ = useDashboard()
  const { isLightTheme } = useTheme()
  const { onSave, rollbackEdit } = useHelper()
  const gaussBlur = useGaussBlur()

  const activePreset = dsb$.themePreset
  const selectedPreset =
    THEME_PRESET_OPTIONS.find((preset) => preset.value === activePreset) ?? THEME_PRESET_OPTIONS[0]
  const storeTouched = dsb$.anyTouched(APPEARANCE_STORE_FIELDS)
  const currentOverrides: TThemePresetOverrides = {
    pageBg: dsb$.pageBg,
    pageBgDark: dsb$.pageBgDark,
    pageCustomBg: dsb$.pageCustomBg,
    pageCustomBgDark: dsb$.pageCustomBgDark,
    pageCustomIntensity: dsb$.pageCustomIntensity,
    pageCustomIntensityDark: dsb$.pageCustomIntensityDark,
    primaryColor: dsb$.primaryColor,
    primaryCustomColor: dsb$.primaryCustomColor,
    primaryCustomColorDark: dsb$.primaryCustomColorDark,
    subPrimaryColor: dsb$.subPrimaryColor,
    textTitle: dsb$.textTitle,
    textDigest: dsb$.textDigest,
  }
  const selectedOverrides = storeTouched ? currentOverrides : selectedPreset.overrides

  const selectedPageBgDraft = useMemo(() => toPageBgDraft(selectedOverrides), [selectedOverrides])
  const {
    draft: pageBgDraft,
    setDraft: setPageBgDraft,
    isTouched: pageBgDraftTouched,
    resetDraft: resetPageBgDraft,
  } = useLocalDraft(selectedPageBgDraft, selectedPageBgDraft)
  const isTouched = storeTouched || pageBgDraftTouched
  const previewRawBg = useMemo(
    () => resolveRawBg(pageBgDraft, isLightTheme),
    [pageBgDraft, isLightTheme],
  )
  const previewBackground = useMemo(() => {
    if (!previewRawBg) return null
    return blurRGB(previewRawBg, gaussBlur)
  }, [gaussBlur, previewRawBg])

  useMainBackgroundPreview(previewBackground, { enabled: pageBgDraftTouched })

  const selectPreset = (preset: TThemePresetOption) => {
    dsb$.editFields({
      themePreset: preset.value,
      themeOverrides: { ...preset.overrides },
      ...preset.overrides,
    })
  }

  const saveAppearance = () => {
    const themeOverrides = {
      ...selectedOverrides,
      ...pageBgDraft,
    }

    dsb$.editFields({
      ...pageBgDraft,
      themeOverrides,
    })
    onSave(FIELD.THEME_PRESET)
  }

  const cancelAppearance = () => {
    resetPageBgDraft()
    rollbackEdit(FIELD.THEME_PRESET)
  }

  return {
    activePreset,
    selectedOverrides,
    selectedPageBgDraft,
    pageBgDraft,
    setPageBgDraft,
    isTouched,
    isLightTheme,
    primaryCustomColor: isLightTheme
      ? selectedOverrides.primaryCustomColor
      : selectedOverrides.primaryCustomColorDark,
    selectPreset,
    saveAppearance,
    cancelAppearance,
    editField: dsb$.editField,
  }
}
