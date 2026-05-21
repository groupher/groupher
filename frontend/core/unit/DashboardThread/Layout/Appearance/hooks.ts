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

import { FIELD, PRESET_FIELD } from '../../constant'
import useHelper from '../../logic/useHelper'
import type { TThemePresetOption, TThemePresetOverwrite } from './spec'

const APPEARANCE_STORE_FIELDS = [
  FIELD.THEME_PRESET,
  FIELD.THEME_TOKENS,
  FIELD.TEXT_TITLE,
  FIELD.TEXT_DIGEST,
  FIELD.GAUSS_BLUR,
  FIELD.GAUSS_BLUR_DARK,
] as const

const THEME_TOKEN_MIRROR_FIELDS = [
  FIELD.TEXT_TITLE,
  FIELD.TEXT_DIGEST,
  FIELD.GAUSS_BLUR,
  FIELD.GAUSS_BLUR_DARK,
] as const

const PREVIEW_CSS_VAR_CLEANUP = {
  '--preview-page-bg': null,
  '--preview-glow-opacity': null,
} as const

const toCssOpacity = (opacity = 100): number => {
  const percent = Number(opacity)

  if (Number.isNaN(percent)) return 1

  return Math.min(Math.max(percent, 0), 100) / 100
}

const pickDashboardMirrorPatch = (patch: Partial<TThemePresetOverwrite>) => {
  const mirrorPatch = {} as Partial<TThemePresetOverwrite>

  for (const field of THEME_TOKEN_MIRROR_FIELDS) {
    if (patch[field] !== undefined) {
      mirrorPatch[field] = patch[field] as never
    }
  }

  return mirrorPatch
}

const toPageBgDraft = (overwrite: TThemePresetOverwrite): TPageBgDraft => ({
  pageBg: overwrite.pageBg,
  pageBgDark: overwrite.pageBgDark,
  pageCustomBg: overwrite.pageCustomBg,
  pageCustomBgDark: overwrite.pageCustomBgDark,
  pageCustomIntensity: overwrite.pageCustomIntensity,
  pageCustomIntensityDark: overwrite.pageCustomIntensityDark,
})

export default function useAppearance() {
  const dsb$ = useDashboard()
  const { isLightTheme } = useTheme()
  const { onSave, rollbackEdit } = useHelper()
  const selectedOverwrite = pickResolvedThemePresetFields(useThemePreset())
  const updatePreviewCssVars = useUpdatePreviewCssVars()
  const [pageBgResetVersion, setPageBgResetVersion] = useState(0)

  const activePreset = dsb$.themePreset
  const storeTouched = dsb$.anyTouched(APPEARANCE_STORE_FIELDS)
  const selectedPageBgDraft = useMemo(() => toPageBgDraft(selectedOverwrite), [selectedOverwrite])
  const isTouched = storeTouched
  const selectedOverwriteRef = useRef(selectedOverwrite)
  const selectedPageBgDraftRef = useRef(selectedPageBgDraft)

  useEffect(() => {
    selectedOverwriteRef.current = selectedOverwrite
    selectedPageBgDraftRef.current = selectedPageBgDraft
  }, [selectedOverwrite, selectedPageBgDraft])

  const commitThemePresetPatch = useCallback(
    (patch: Partial<TThemePresetOverwrite>) => {
      const nextTokens = {
        ...selectedOverwriteRef.current,
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
  } = useDebouncedPreviewCommit<TThemePresetOverwrite>({ onCommit: commitThemePresetPatch })

  const clearPreviewCssVars = useCallback(() => {
    updatePreviewCssVars(PREVIEW_CSS_VAR_CLEANUP)
  }, [updatePreviewCssVars])

  const selectPreset = (preset: TThemePresetOption) => {
    clearPendingThemePresetPreviewCommit()
    clearPreviewCssVars()
    dsb$.editFields({
      themePreset: preset.value,
      themeTokens: { ...preset.overwrite },
      ...pickDashboardMirrorPatch(preset.overwrite),
    })
  }

  const previewPageBg = useCallback(
    (patch: Partial<TPageBgDraft>) => {
      const previewRawBg = resolveRawBg(
        { ...selectedPageBgDraftRef.current, ...patch },
        isLightTheme,
      )
      const activeGaussBlur = isLightTheme
        ? selectedOverwriteRef.current.gaussBlur
        : selectedOverwriteRef.current.gaussBlurDark
      const previewBackground = previewRawBg ? blurRGB(previewRawBg, activeGaussBlur) : null

      updatePreviewCssVars({ '--preview-page-bg': previewBackground })
    },
    [isLightTheme, updatePreviewCssVars],
  )

  const previewThemePresetPatch = useCallback(
    (patch: Partial<TThemePresetOverwrite>) => {
      const nextOverwrite = {
        ...selectedOverwriteRef.current,
        ...patch,
      }
      const previewRawBg = resolveRawBg(selectedPageBgDraftRef.current, isLightTheme)
      const activeGaussBlur = isLightTheme ? nextOverwrite.gaussBlur : nextOverwrite.gaussBlurDark
      const previewBackground = previewRawBg ? blurRGB(previewRawBg, activeGaussBlur) : null
      const glowOpacityField = isLightTheme
        ? PRESET_FIELD.GLOW_OPACITY
        : PRESET_FIELD.GLOW_OPACITY_DARK
      const previewVars = {
        '--preview-page-bg': previewBackground,
      } as Record<`--${string}`, string | number | null>

      if (patch[glowOpacityField] !== undefined) {
        const activeGlowOpacity = isLightTheme
          ? nextOverwrite.glowOpacity
          : nextOverwrite.glowOpacityDark

        previewVars['--preview-glow-opacity'] = toCssOpacity(activeGlowOpacity)
      }

      updatePreviewCssVars(previewVars)
    },
    [isLightTheme, updatePreviewCssVars],
  )

  const scheduleThemePresetPatch = useCallback(
    (patch: Partial<TThemePresetOverwrite>) => {
      scheduleThemePresetPreviewCommit(patch)
    },
    [scheduleThemePresetPreviewCommit],
  )

  const saveAppearance = () => {
    flushThemePresetPreviewCommit()
    clearPreviewCssVars()
    onSave(FIELD.THEME_PRESET)
  }

  const cancelAppearance = () => {
    clearPendingThemePresetPreviewCommit()
    clearPreviewCssVars()
    rollbackEdit(FIELD.THEME_PRESET)
    setPageBgResetVersion((version) => version + 1)
  }

  return {
    activePreset,
    selectedOverwrite,
    selectedPageBgDraft,
    isTouched,
    isLightTheme,
    primaryCustomColor: isLightTheme
      ? selectedOverwrite.primaryCustomColor
      : selectedOverwrite.primaryCustomColorDark,
    selectPreset,
    previewPageBg,
    previewThemePresetPatch,
    scheduleThemePresetPatch,
    flushThemePresetPreviewCommit,
    commitThemePresetPatch,
    pageBgResetKey: `${activePreset}-${isLightTheme ? 'light' : 'dark'}-${pageBgResetVersion}`,
    saveAppearance,
    cancelAppearance,
  }
}
