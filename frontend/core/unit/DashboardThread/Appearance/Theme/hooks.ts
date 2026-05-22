import { equals } from 'ramda'
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
import type { TThemeDetails, TThemePresetOption, TThemePresetOverwrite } from './spec'

const APPEARANCE_STORE_FIELDS = [
  FIELD.THEME_PRESET,
  FIELD.THEME_PRESET_BASE,
  FIELD.THEME_TOKENS,
  FIELD.TEXT_TITLE,
  FIELD.TEXT_TITLE_DARK,
  FIELD.TEXT_DIGEST,
  FIELD.TEXT_DIGEST_DARK,
  FIELD.GAUSS_BLUR,
  FIELD.GAUSS_BLUR_DARK,
] as const

const THEME_TOKEN_MIRROR_FIELDS = [
  FIELD.TEXT_TITLE,
  FIELD.TEXT_TITLE_DARK,
  FIELD.TEXT_DIGEST,
  FIELD.TEXT_DIGEST_DARK,
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
  const [editingDetails, setEditingDetails] = useState(false)
  const [showForkRelation, setShowForkRelation] = useState(false)
  const [customPresetDraft, setCustomPresetDraft] = useState<TThemePresetOverwrite | null>(null)

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
    customPresetDraft ??
    (activePreset === THEME_PRESET.CUSTOM ? selectedOverwrite : customBaseOverwrite)
  const selectedOverwriteRef = useRef(selectedOverwrite)
  const selectedPageBgDraftRef = useRef(selectedPageBgDraft)
  const customPresetDraftRef = useRef<TThemePresetOverwrite | null>(customPresetDraft)

  const updateCustomPresetDraft = useCallback((overwrite: TThemePresetOverwrite) => {
    customPresetDraftRef.current = overwrite
    setCustomPresetDraft(overwrite)
  }, [])

  useEffect(() => {
    selectedOverwriteRef.current = selectedOverwrite
    selectedPageBgDraftRef.current = selectedPageBgDraft
  }, [selectedOverwrite, selectedPageBgDraft])

  useEffect(() => {
    if (activePreset !== THEME_PRESET.CUSTOM) return
    if (equals(customPresetDraftRef.current, selectedOverwrite)) return

    updateCustomPresetDraft(selectedOverwrite)
  }, [activePreset, selectedOverwrite, updateCustomPresetDraft])

  const buildCustomPresetEditPatch = useCallback(
    (patch: Partial<TThemePresetOverwrite> = {}) => {
      const themePresetBase =
        dsb$.themePreset === THEME_PRESET.CUSTOM ? dsb$.themePresetBase : dsb$.themePreset
      // `themeTokens` is the active preset payload from the API, so selecting a
      // read-only preset replaces it with that preset's resolved tokens. Keep a
      // separate Custom draft in this hook so unsaved Custom detail edits can
      // survive temporarily switching to Default/Claude/etc. and back.
      const baseOverwrite =
        dsb$.themePreset === THEME_PRESET.CUSTOM
          ? (customPresetDraftRef.current ?? selectedOverwriteRef.current)
          : selectedOverwriteRef.current
      const nextTokens = {
        ...baseOverwrite,
        ...patch,
      }

      updateCustomPresetDraft(nextTokens)

      return {
        themePreset: THEME_PRESET.CUSTOM,
        themePresetBase,
        themeTokens: nextTokens,
      }
    },
    [dsb$, updateCustomPresetDraft],
  )

  const enterCustomPresetTokenEdit = useCallback(
    (patch: Partial<TThemePresetOverwrite> = {}) => {
      // Detail controls always save as Custom tokens, but the visual
      // "forked from" relation is only meaningful when the edit starts from a
      // read-only preset. Editing an existing Custom preset should stay in the
      // normal stacked preset list and only move the save bar to details.
      setEditingDetails(true)
      setShowForkRelation(dsb$.themePreset !== THEME_PRESET.CUSTOM)
      return buildCustomPresetEditPatch(patch)
    },
    [buildCustomPresetEditPatch, dsb$],
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
    setEditingDetails(true)
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

    const isCustomPreset = preset.value === THEME_PRESET.CUSTOM
    const nextOverwrite = isCustomPreset
      ? (customPresetDraftRef.current ?? preset.overwrite)
      : preset.overwrite

    setEditingDetails(false)
    setShowForkRelation(false)
    clearPendingThemePresetPreviewCommit()
    clearPreviewCssVars()
    dsb$.editFields({
      themePreset: preset.value,
      themePresetBase:
        isCustomPreset || dsb$.hasCustomThemePreset ? dsb$.themePresetBase : preset.value,
      themeTokens: { ...nextOverwrite },
      ...pickDashboardMirrorPatch(nextOverwrite),
    })
  }

  const resetCustomPresetTo = useCallback(
    (preset: TThemePresetOption) => {
      if (dsb$.themePreset !== THEME_PRESET.CUSTOM) return

      const nextOverwrite = { ...preset.overwrite }

      clearPendingThemePresetPreviewCommit()
      clearPreviewCssVars()
      setEditingDetails(true)
      setShowForkRelation(false)
      updateCustomPresetDraft(nextOverwrite)
      dsb$.editFields({
        themePreset: THEME_PRESET.CUSTOM,
        themePresetBase: preset.value,
        themeTokens: nextOverwrite,
        ...pickDashboardMirrorPatch(nextOverwrite),
      })
      setPageBgResetVersion((version) => version + 1)
    },
    [clearPendingThemePresetPreviewCommit, clearPreviewCssVars, dsb$, updateCustomPresetDraft],
  )

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
        setEditingDetails(true)
        setShowForkRelation(false)
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
    setEditingDetails(false)
    setShowForkRelation(false)
    rollbackEdit(FIELD.THEME_PRESET)
    setPageBgResetVersion((version) => version + 1)
  }

  // Save-bar placement follows where the edit happened, not whether the active
  // preset is Custom. Custom details edits save under the details panel without
  // showing fork UI; preset-card selections save under the preset list.
  const showDetailsSavingBar = isTouched && editingDetails
  const showPresetSavingBar = isTouched && !editingDetails
  const primaryColor = isLightTheme
    ? selectedOverwrite.primaryColor
    : selectedOverwrite.primaryColorDark
  const accentColor = isLightTheme
    ? selectedOverwrite.accentColor
    : selectedOverwrite.accentColorDark
  const pageBgResetKey = `${activePreset}-${isLightTheme ? 'light' : 'dark'}-${pageBgResetVersion}`
  const details: TThemeDetails = {
    selectedOverwrite,
    selectedPageBgDraft,
    primaryColor,
    accentColor,
    isLightTheme,
    pageBgResetKey,
    onPageBgPreview: previewPageBg,
    onPageBgCommit: scheduleThemePresetPatch,
    onThemePresetPreview: previewThemePresetPatch,
    onThemePresetSchedule: scheduleThemePresetPatch,
    onThemePresetFlush: flushThemePresetPreviewCommit,
    onThemePresetCommit: commitThemePresetPatch,
  }

  return {
    activePreset,
    activePresetBase,
    hasCustomThemePreset: dsb$.hasCustomThemePreset,
    customPresetOverwrite,
    showForkRelation: activePreset === THEME_PRESET.CUSTOM && isTouched && showForkRelation,
    showResetMenu: activePreset === THEME_PRESET.CUSTOM,
    isTouched,
    showDetailsSavingBar,
    showPresetSavingBar,
    details,
    selectPreset,
    resetCustomPresetTo,
    saveAppearance,
    cancelAppearance,
  }
}
