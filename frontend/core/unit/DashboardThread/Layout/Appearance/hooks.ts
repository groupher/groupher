import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { blurRGB } from '~/fmt'
import useDebouncedPreviewCommit from '~/hooks/useDebouncedPreviewCommit'
import useGaussBlur from '~/hooks/useGaussBlur'
import useTheme from '~/hooks/useTheme'
import useThemePreset from '~/hooks/useThemePreset'
import useUpdatePreviewCssVars from '~/hooks/useUpdatePreviewCssVars'
import { pickResolvedThemePresetFields } from '~/lib/themePreset'
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
  const selectedOverrides = pickResolvedThemePresetFields(useThemePreset())
  const updatePreviewCssVars = useUpdatePreviewCssVars()
  const [pageBgResetVersion, setPageBgResetVersion] = useState(0)

  const activePreset = dsb$.themePreset
  const storeTouched = dsb$.anyTouched(APPEARANCE_STORE_FIELDS)
  const selectedPageBgDraft = useMemo(() => toPageBgDraft(selectedOverrides), [selectedOverrides])
  const isTouched = storeTouched
  const selectedOverridesRef = useRef(selectedOverrides)
  const selectedPageBgDraftRef = useRef(selectedPageBgDraft)

  useEffect(() => {
    selectedOverridesRef.current = selectedOverrides
    selectedPageBgDraftRef.current = selectedPageBgDraft
  }, [selectedOverrides, selectedPageBgDraft])

  const commitThemePresetPatch = useCallback(
    (patch: Partial<TThemePresetOverrides>) => {
      dsb$.editFields({
        ...patch,
        themeOverrides: {
          ...selectedOverridesRef.current,
          ...patch,
        },
      })
    },
    [dsb$],
  )
  const {
    schedule: scheduleThemePresetPreviewCommit,
    flush: flushThemePresetPreviewCommit,
    clear: clearPendingThemePresetPreviewCommit,
  } = useDebouncedPreviewCommit<TThemePresetOverrides>({ onCommit: commitThemePresetPatch })

  const selectPreset = (preset: TThemePresetOption) => {
    clearPendingThemePresetPreviewCommit()
    updatePreviewCssVars({ '--preview-page-bg': null })
    dsb$.editFields({
      themePreset: preset.value,
      themeOverrides: { ...preset.overrides },
      ...preset.overrides,
    })
  }

  const previewPageBg = useCallback(
    (patch: Partial<TPageBgDraft>) => {
      const previewRawBg = resolveRawBg(
        { ...selectedPageBgDraftRef.current, ...patch },
        isLightTheme,
      )
      const previewBackground = previewRawBg ? blurRGB(previewRawBg, gaussBlur) : null

      updatePreviewCssVars({ '--preview-page-bg': previewBackground })
    },
    [gaussBlur, isLightTheme, updatePreviewCssVars],
  )

  const scheduleThemePresetPatch = useCallback(
    (patch: Partial<TThemePresetOverrides>) => {
      scheduleThemePresetPreviewCommit(patch)
    },
    [scheduleThemePresetPreviewCommit],
  )

  const saveAppearance = () => {
    flushThemePresetPreviewCommit()
    updatePreviewCssVars({ '--preview-page-bg': null })
    onSave(FIELD.THEME_PRESET)
  }

  const cancelAppearance = () => {
    clearPendingThemePresetPreviewCommit()
    updatePreviewCssVars({ '--preview-page-bg': null })
    rollbackEdit(FIELD.THEME_PRESET)
    setPageBgResetVersion((version) => version + 1)
  }

  return {
    activePreset,
    selectedOverrides,
    selectedPageBgDraft,
    isTouched,
    isLightTheme,
    primaryCustomColor: isLightTheme
      ? selectedOverrides.primaryCustomColor
      : selectedOverrides.primaryCustomColorDark,
    selectPreset,
    previewPageBg,
    scheduleThemePresetPatch,
    commitThemePresetPatch,
    pageBgResetKey: `${activePreset}-${isLightTheme ? 'light' : 'dark'}-${pageBgResetVersion}`,
    saveAppearance,
    cancelAppearance,
  }
}
