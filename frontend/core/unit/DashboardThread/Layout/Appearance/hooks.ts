import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { THEME_PRESET } from '~/const/theme_preset'
import { blurRGB } from '~/fmt'
import useDebouncedPreviewCommit from '~/hooks/useDebouncedPreviewCommit'
import useTheme from '~/hooks/useTheme'
import useThemePreset from '~/hooks/useThemePreset'
import useUpdatePreviewCssVars from '~/hooks/useUpdatePreviewCssVars'
import { pickResolvedThemePresetFields } from '~/lib/themePreset'
import useDashboard from '~/stores/dashboard/hooks'
import { resolveRawBg, type TPageBgDraft } from '~/widgets/CustomPageBg/hooks'

import { FIELD } from '../../constant'
import useHelper from '../../logic/useHelper'
import type { TThemePresetOption, TThemePresetOverrides } from './spec'

const APPEARANCE_STORE_FIELDS = [
  FIELD.THEME_PRESET,
  FIELD.THEME_TOKENS,
  FIELD.PAGE_BG,
  FIELD.PAGE_BG_DARK,
  FIELD.TEXT_TITLE,
  FIELD.TEXT_DIGEST,
  FIELD.PAGE_CUSTOM_BG,
  FIELD.PAGE_CUSTOM_BG_DARK,
  FIELD.PAGE_CUSTOM_INTENSITY,
  FIELD.PAGE_CUSTOM_INTENSITY_DARK,
  FIELD.GAUSS_BLUR,
  FIELD.GAUSS_BLUR_DARK,
] as const

const THEME_TOKEN_MIRROR_FIELDS = [
  FIELD.PAGE_BG,
  FIELD.PAGE_BG_DARK,
  FIELD.PAGE_CUSTOM_BG,
  FIELD.PAGE_CUSTOM_BG_DARK,
  FIELD.PAGE_CUSTOM_INTENSITY,
  FIELD.PAGE_CUSTOM_INTENSITY_DARK,
  FIELD.TEXT_TITLE,
  FIELD.TEXT_DIGEST,
  FIELD.GAUSS_BLUR,
  FIELD.GAUSS_BLUR_DARK,
] as const

const pickDashboardMirrorPatch = (patch: Partial<TThemePresetOverrides>) => {
  const mirrorPatch = {} as Partial<TThemePresetOverrides>

  for (const field of THEME_TOKEN_MIRROR_FIELDS) {
    if (patch[field] !== undefined) {
      mirrorPatch[field] = patch[field] as never
    }
  }

  return mirrorPatch
}

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
      const nextTokens = {
        ...selectedOverridesRef.current,
        ...patch,
      }
      dsb$.editFields({
        ...pickDashboardMirrorPatch(patch),
        themePreset: THEME_PRESET.CUSTOM,
        themeTokens: nextTokens,
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
      themeTokens: { ...preset.overrides },
      ...pickDashboardMirrorPatch(preset.overrides),
    })
  }

  const previewPageBg = useCallback(
    (patch: Partial<TPageBgDraft>) => {
      const previewRawBg = resolveRawBg(
        { ...selectedPageBgDraftRef.current, ...patch },
        isLightTheme,
      )
      const activeGaussBlur = isLightTheme
        ? selectedOverridesRef.current.gaussBlur
        : selectedOverridesRef.current.gaussBlurDark
      const previewBackground = previewRawBg ? blurRGB(previewRawBg, activeGaussBlur) : null

      updatePreviewCssVars({ '--preview-page-bg': previewBackground })
    },
    [isLightTheme, updatePreviewCssVars],
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
