import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { THEME_PRESET, THEME_PRESET_OPTIONS } from '~/const/theme_preset'
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
  FIELD.THEME_PRESET_BASE,
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
})

export default function useAppearance() {
  const dsb$ = useDashboard()
  const { isLightTheme } = useTheme()
  const { onSave, rollbackEdit } = useHelper()
  const selectedOverwrite = pickResolvedThemePresetFields(useThemePreset())
  const updatePreviewCssVars = useUpdatePreviewCssVars()
  const [pageBgResetVersion, setPageBgResetVersion] = useState(0)
  const [showForkRelation, setShowForkRelation] = useState(false)

  const activePreset = dsb$.themePreset
  const activePresetBase =
    activePreset === THEME_PRESET.CUSTOM ? dsb$.themePresetBase : activePreset
  const storeTouched = dsb$.anyTouched(APPEARANCE_STORE_FIELDS)
  const selectedPageBgDraft = useMemo(() => toPageBgDraft(selectedOverwrite), [selectedOverwrite])
  const isTouched = storeTouched
  const customBaseOverwrite =
    THEME_PRESET_OPTIONS.find((preset) => preset.value === dsb$.themePresetBase)?.overwrite ??
    THEME_PRESET_OPTIONS[0].overwrite
  const customPresetOverwrite =
    activePreset === THEME_PRESET.CUSTOM ? selectedOverwrite : customBaseOverwrite
  const selectedOverwriteRef = useRef(selectedOverwrite)
  const selectedPageBgDraftRef = useRef(selectedPageBgDraft)

  useEffect(() => {
    selectedOverwriteRef.current = selectedOverwrite
    selectedPageBgDraftRef.current = selectedPageBgDraft
  }, [selectedOverwrite, selectedPageBgDraft])

  const buildCustomPresetEditPatch = useCallback(
    (patch: Partial<TThemePresetOverwrite> = {}) => {
      const themePresetBase =
        dsb$.themePreset === THEME_PRESET.CUSTOM ? dsb$.themePresetBase : dsb$.themePreset
      const nextTokens = {
        ...selectedOverwriteRef.current,
        ...patch,
      }

      return {
        themePreset: THEME_PRESET.CUSTOM,
        themePresetBase,
        themeTokens: nextTokens,
      }
    },
    [dsb$],
  )

  const enterCustomPresetTokenEdit = useCallback(
    (patch: Partial<TThemePresetOverwrite> = {}) => {
      // Both delayed controls (ranges/background) and immediate controls
      // (primary/accent colors, glow swatches) must enter the same fork UI.
      // Keep the transition here so every theme token edit first becomes a
      // Custom preset edit, while built-in presets remain read-only.
      setShowForkRelation(true)
      return buildCustomPresetEditPatch(patch)
    },
    [buildCustomPresetEditPatch],
  )

  const commitThemePresetPatch = useCallback(
    (patch: Partial<TThemePresetOverwrite>) => {
      dsb$.editFields({
        ...enterCustomPresetTokenEdit(patch),
        ...pickDashboardMirrorPatch(patch),
      })
    },
    [dsb$, enterCustomPresetTokenEdit],
  )
  const forkCustomPreset = useCallback(() => {
    setShowForkRelation(true)
    dsb$.editFields(buildCustomPresetEditPatch())
  }, [buildCustomPresetEditPatch, dsb$])

  const {
    schedule: scheduleThemePresetPreviewCommit,
    flush: flushThemePresetPreviewCommit,
    clear: clearPendingThemePresetPreviewCommit,
  } = useDebouncedPreviewCommit<TThemePresetOverwrite>({ onCommit: commitThemePresetPatch })

  const clearPreviewCssVars = useCallback(() => {
    updatePreviewCssVars(PREVIEW_CSS_VAR_CLEANUP)
  }, [updatePreviewCssVars])

  const selectPreset = (preset: TThemePresetOption) => {
    if (preset.value === THEME_PRESET.CUSTOM && !dsb$.hasCustomThemePreset) return

    setShowForkRelation(false)
    clearPendingThemePresetPreviewCommit()
    clearPreviewCssVars()
    dsb$.editFields({
      themePreset: preset.value,
      themePresetBase:
        preset.value === THEME_PRESET.CUSTOM || dsb$.hasCustomThemePreset
          ? dsb$.themePresetBase
          : preset.value,
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
      const previewRawBg = resolveRawBg(toPageBgDraft(nextOverwrite), isLightTheme)
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
      if (dsb$.themePreset !== THEME_PRESET.CUSTOM) {
        forkCustomPreset()
      } else {
        setShowForkRelation(true)
      }

      scheduleThemePresetPreviewCommit(patch)
    },
    [dsb$, forkCustomPreset, scheduleThemePresetPreviewCommit],
  )

  const saveAppearance = () => {
    flushThemePresetPreviewCommit()
    clearPreviewCssVars()
    onSave(FIELD.THEME_PRESET)
  }

  const cancelAppearance = () => {
    clearPendingThemePresetPreviewCommit()
    clearPreviewCssVars()
    setShowForkRelation(false)
    rollbackEdit(FIELD.THEME_PRESET)
    setPageBgResetVersion((version) => version + 1)
  }

  // Details edits always enter the Custom fork view, while preset-list clicks
  // clear it. Reuse that split to keep preset-only saves directly under the
  // preset list and details edits under the details panel.
  const showDetailsSavingBar = isTouched && showForkRelation
  const showPresetSavingBar = isTouched && !showForkRelation

  return {
    activePreset,
    activePresetBase,
    hasCustomThemePreset: dsb$.hasCustomThemePreset,
    customPresetOverwrite,
    showForkRelation: activePreset === THEME_PRESET.CUSTOM && isTouched && showForkRelation,
    selectedOverwrite,
    selectedPageBgDraft,
    isTouched,
    showDetailsSavingBar,
    showPresetSavingBar,
    isLightTheme,
    primaryColor: isLightTheme
      ? selectedOverwrite.primaryColor
      : selectedOverwrite.primaryColorDark,
    accentColor: isLightTheme ? selectedOverwrite.accentColor : selectedOverwrite.accentColorDark,
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
