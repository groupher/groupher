import { equals } from 'ramda'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { THEME_PRESET } from '~/const/theme_preset'
import useTheme from '~/hooks/useTheme'
import useThemePreset from '~/hooks/useThemePreset'
import { pickResolvedThemePresetFields } from '~/lib/themePreset'
import useDashboard from '~/stores/dashboard/hooks'

import {
  buildCustomPresetEditPatch,
  buildCustomPresetResetPatch,
  buildPresetSelectionPatch,
  pickDashboardMirrorPatch,
  toPageBgDraft,
} from '../helper'
import type {
  TThemeDetails,
  TThemePresetOption,
  TThemePresetOverwrite,
  TUseAppearanceOptions,
  TUseAppearanceRet,
} from '../spec'
import useThemePresetDraft from './useThemePresetDraft'
import useThemePresetMutation from './useThemePresetMutation'
import useThemePresetPreview from './useThemePresetPreview'

/**
 * Build the Appearance Theme view model from dashboard and ThemePreset stores.
 *
 * Intent: keep the component focused on rendering while this hook coordinates
 * preset selection, Custom draft state, realtime preview, save-bar placement,
 * and save/cancel actions.
 *
 * Example:
 *   const appearance = useAppearance({ initialPresetOptions })
 *   appearance.selectPreset(appearance.presetOptions[0])
 */
export default function useAppearance({
  initialPresetOptions = [],
}: TUseAppearanceOptions = {}): TUseAppearanceRet {
  const dsb$ = useDashboard()
  const { isLightTheme } = useTheme()
  const { isThemePresetTouched, editThemePresetFields } = useThemePresetDraft()
  const { saveThemePreset, rollbackThemePreset } = useThemePresetMutation()
  const themePreset$ = useThemePreset()
  const selectedOverwrite = pickResolvedThemePresetFields(themePreset$)
  const presetOptions = themePreset$.presetOptions.length
    ? themePreset$.presetOptions
    : initialPresetOptions
  const [pageBgResetVersion, setPageBgResetVersion] = useState(0)
  const [editingDetails, setEditingDetails] = useState(false)
  const [showForkRelation, setShowForkRelation] = useState(false)
  const [customPresetDraft, setCustomPresetDraft] = useState<TThemePresetOverwrite | null>(null)
  const editingDetailsRef = useRef(editingDetails)
  const showForkRelationRef = useRef(showForkRelation)

  const activePreset = dsb$.themePreset
  const activePresetBase =
    activePreset === THEME_PRESET.CUSTOM ? dsb$.themePresetBase : activePreset
  const selectedPageBgDraft = useMemo(() => toPageBgDraft(selectedOverwrite), [selectedOverwrite])
  const customBaseOverwrite =
    presetOptions.find((preset) => preset.value === dsb$.themePresetBase)?.overwrite ??
    selectedOverwrite
  const customPresetOverwrite =
    customPresetDraft ??
    (activePreset === THEME_PRESET.CUSTOM ? selectedOverwrite : customBaseOverwrite)
  const selectedOverwriteRef = useRef(selectedOverwrite)
  const customPresetDraftRef = useRef<TThemePresetOverwrite | null>(customPresetDraft)

  const updateEditingDetails = useCallback((nextEditingDetails: boolean) => {
    if (editingDetailsRef.current === nextEditingDetails) return

    editingDetailsRef.current = nextEditingDetails
    setEditingDetails(nextEditingDetails)
  }, [])

  const updateShowForkRelation = useCallback((nextShowForkRelation: boolean) => {
    if (showForkRelationRef.current === nextShowForkRelation) return

    showForkRelationRef.current = nextShowForkRelation
    setShowForkRelation(nextShowForkRelation)
  }, [])

  const updateCustomPresetDraft = useCallback((overwrite: TThemePresetOverwrite) => {
    customPresetDraftRef.current = overwrite
    setCustomPresetDraft(overwrite)
  }, [])

  useEffect(() => {
    selectedOverwriteRef.current = selectedOverwrite
  }, [selectedOverwrite])

  useEffect(() => {
    if (activePreset !== THEME_PRESET.CUSTOM) return
    if (equals(customPresetDraftRef.current, selectedOverwrite)) return

    updateCustomPresetDraft(selectedOverwrite)
  }, [activePreset, selectedOverwrite, updateCustomPresetDraft])

  const enterCustomPresetTokenEdit = useCallback(
    (patch: Partial<TThemePresetOverwrite> = {}) => {
      // Detail controls always save as Custom tokens, but the visual
      // "forked from" relation is only meaningful when the edit starts from a
      // read-only preset. Editing an existing Custom preset should stay in the
      // normal stacked preset list and only move the save bar to details.
      updateEditingDetails(true)
      updateShowForkRelation(dsb$.themePreset !== THEME_PRESET.CUSTOM)

      const { dashboardPatch, nextCustomPresetDraft } = buildCustomPresetEditPatch({
        activePreset: dsb$.themePreset,
        activePresetBase: dsb$.themePresetBase,
        selectedOverwrite: selectedOverwriteRef.current,
        customPresetDraft: customPresetDraftRef.current,
        patch,
      })

      updateCustomPresetDraft(nextCustomPresetDraft)

      return dashboardPatch
    },
    [dsb$, updateCustomPresetDraft, updateEditingDetails, updateShowForkRelation],
  )

  const commitThemePresetPatch = useCallback(
    (patch: Partial<TThemePresetOverwrite>) => {
      editThemePresetFields({
        ...enterCustomPresetTokenEdit(patch),
        ...pickDashboardMirrorPatch(patch),
      })
    },
    [editThemePresetFields, enterCustomPresetTokenEdit],
  )
  const {
    previewPageBg,
    previewThemePresetPatch,
    scheduleThemePresetPatch: scheduleThemePresetPreviewPatch,
    flushThemePresetPreviewCommit,
    clearPendingThemePresetPreviewCommit,
    clearPreviewCssVars,
  } = useThemePresetPreview({
    selectedOverwrite,
    selectedPageBgDraft,
    isLightTheme,
    onCommit: commitThemePresetPatch,
  })

  const selectPreset = (preset: TThemePresetOption) => {
    if (preset.value === THEME_PRESET.CUSTOM && !dsb$.hasCustomThemePreset) return

    updateEditingDetails(false)
    updateShowForkRelation(false)
    clearPendingThemePresetPreviewCommit()
    clearPreviewCssVars()

    editThemePresetFields(
      buildPresetSelectionPatch({
        preset,
        currentThemePresetBase: dsb$.themePresetBase,
        hasCustomThemePreset: dsb$.hasCustomThemePreset,
        customPresetDraft: customPresetDraftRef.current,
      }).dashboardPatch,
    )
  }

  const resetCustomPresetTo = useCallback(
    (preset: TThemePresetOption) => {
      if (dsb$.themePreset !== THEME_PRESET.CUSTOM) return

      const { dashboardPatch, nextCustomPresetDraft } = buildCustomPresetResetPatch(preset)

      clearPendingThemePresetPreviewCommit()
      clearPreviewCssVars()
      updateEditingDetails(true)
      updateShowForkRelation(false)
      updateCustomPresetDraft(nextCustomPresetDraft)

      editThemePresetFields(dashboardPatch)
      setPageBgResetVersion((version) => version + 1)
    },
    [
      clearPendingThemePresetPreviewCommit,
      clearPreviewCssVars,
      dsb$,
      editThemePresetFields,
      updateCustomPresetDraft,
      updateEditingDetails,
      updateShowForkRelation,
    ],
  )

  const scheduleThemePresetPatch = useCallback(
    (patch: Partial<TThemePresetOverwrite>) => {
      // Keep high-frequency slider drags out of the dashboard store. The preview
      // path already updates CSS vars immediately; touching the store here would
      // re-render the Appearance panel on every pointer move. The eventual
      // debounced commit is still needed so the save bar and draft state catch up.
      updateEditingDetails(true)
      updateShowForkRelation(dsb$.themePreset !== THEME_PRESET.CUSTOM)

      scheduleThemePresetPreviewPatch(patch)
    },
    [dsb$, scheduleThemePresetPreviewPatch, updateEditingDetails, updateShowForkRelation],
  )

  const saveAppearance = () => {
    flushThemePresetPreviewCommit()
    clearPreviewCssVars()
    saveThemePreset()
  }

  const cancelAppearance = () => {
    clearPendingThemePresetPreviewCommit()
    clearPreviewCssVars()
    updateEditingDetails(false)
    updateShowForkRelation(false)
    rollbackThemePreset()
    setPageBgResetVersion((version) => version + 1)
  }

  // Save-bar placement follows where the edit happened, not whether the active
  // preset is Custom. Custom details edits save under the details panel without
  // showing fork UI; preset-card selections save under the preset list.
  const showDetailsSavingBar = isThemePresetTouched && editingDetails
  const showPresetSavingBar = isThemePresetTouched && !editingDetails
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
    presetOptions,
    customPresetOverwrite,
    showForkRelation:
      activePreset === THEME_PRESET.CUSTOM && isThemePresetTouched && showForkRelation,
    showResetMenu: activePreset === THEME_PRESET.CUSTOM,
    isTouched: isThemePresetTouched,
    showDetailsSavingBar,
    showPresetSavingBar,
    details,
    selectPreset,
    resetCustomPresetTo,
    saveAppearance,
    cancelAppearance,
  }
}
