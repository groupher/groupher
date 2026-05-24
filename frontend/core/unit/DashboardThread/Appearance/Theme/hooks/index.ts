import { equals } from 'ramda'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { THEME_PRESET } from '~/const/theme_preset'
import useTheme from '~/hooks/useTheme'
import useThemePreset from '~/hooks/useThemePreset'
import type { TResolvedThemePreset } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import {
  buildCustomPresetEditOverwrite,
  buildCustomPresetResetOverwrite,
  buildPresetSelectionFields,
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
  const selectedTokens = themePreset$.themeTokens as TResolvedThemePreset
  const presetOptions = dsb$.themePresets.length
    ? dsb$.themePresets
    : themePreset$.presetOptions.length
      ? themePreset$.presetOptions
      : initialPresetOptions
  const [pageBgResetVersion, setPageBgResetVersion] = useState(0)
  const [editingDetails, setEditingDetails] = useState(false)
  const [showForkRelation, setShowForkRelation] = useState(false)
  const [customTokensDraft, setCustomTokensDraft] = useState<typeof selectedTokens | null>(null)
  const editingDetailsRef = useRef(editingDetails)
  const showForkRelationRef = useRef(showForkRelation)

  const activePreset = dsb$.themePreset
  const savedCustomPresetBase = dsb$.themePresetBase ?? THEME_PRESET.DEFAULT
  const activePresetBase =
    activePreset === THEME_PRESET.CUSTOM ? savedCustomPresetBase : activePreset
  const selectedPageBgDraft = useMemo(() => toPageBgDraft(selectedTokens), [selectedTokens])
  const customPresetOption = presetOptions.find((preset) => preset.value === THEME_PRESET.CUSTOM)
  const customBaseTokens =
    presetOptions.find((preset) => preset.value === savedCustomPresetBase)?.tokens ?? selectedTokens
  const customPresetTokens =
    customTokensDraft ??
    customPresetOption?.tokens ??
    (activePreset === THEME_PRESET.CUSTOM ? selectedTokens : customBaseTokens)
  const selectedTokensRef = useRef(selectedTokens)
  const customTokensDraftRef = useRef<typeof selectedTokens | null>(customTokensDraft)

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

  const updateCustomTokensDraft = useCallback((tokens: typeof selectedTokens | null) => {
    customTokensDraftRef.current = tokens
    setCustomTokensDraft(tokens)
  }, [])

  useEffect(() => {
    selectedTokensRef.current = selectedTokens
  }, [selectedTokens])

  useEffect(() => {
    if (activePreset !== THEME_PRESET.CUSTOM) return
    if (equals(customTokensDraftRef.current, selectedTokens)) return

    updateCustomTokensDraft(selectedTokens)
  }, [activePreset, selectedTokens, updateCustomTokensDraft])

  const enterCustomPresetTokenEdit = useCallback(
    (overwrite: TThemePresetOverwrite = {}) => {
      // Detail controls always save as Custom tokens, but the visual
      // "forked from" relation is only meaningful when the edit starts from a
      // read-only preset. Editing an existing Custom preset should stay in the
      // normal stacked preset list and only move the save bar to details.
      updateEditingDetails(true)
      updateShowForkRelation(dsb$.themePreset !== THEME_PRESET.CUSTOM)

      const { dashboardFields, nextCustomTokensDraft } = buildCustomPresetEditOverwrite({
        activePreset: dsb$.themePreset,
        activePresetBase: savedCustomPresetBase,
        selectedTokens: selectedTokensRef.current,
        customTokensDraft: customTokensDraftRef.current,
        currentThemeOverwrite: dsb$.themeOverwrite,
        overwrite,
      })

      updateCustomTokensDraft(nextCustomTokensDraft)

      return dashboardFields
    },
    [
      dsb$,
      savedCustomPresetBase,
      updateCustomTokensDraft,
      updateEditingDetails,
      updateShowForkRelation,
    ],
  )

  const commitThemePresetOverwrite = useCallback(
    (overwrite: TThemePresetOverwrite) => {
      editThemePresetFields(enterCustomPresetTokenEdit(overwrite))
    },
    [editThemePresetFields, enterCustomPresetTokenEdit],
  )
  const {
    previewPageBg,
    previewThemePresetOverwrite,
    scheduleThemePresetOverwrite: scheduleThemePresetPreviewOverwrite,
    flushThemePresetPreviewCommit,
    clearPendingThemePresetPreviewCommit,
    clearPreviewCssVars,
  } = useThemePresetPreview({
    selectedTokens,
    selectedPageBgDraft,
    isLightTheme,
    onCommit: commitThemePresetOverwrite,
  })

  const selectPreset = (preset: TThemePresetOption) => {
    if (preset.value === THEME_PRESET.CUSTOM && !customPresetOption) return

    updateEditingDetails(false)
    updateShowForkRelation(false)
    clearPendingThemePresetPreviewCommit()
    clearPreviewCssVars()

    editThemePresetFields(
      buildPresetSelectionFields({
        preset,
        currentThemePresetBase: savedCustomPresetBase,
        customTokensDraft: customTokensDraftRef.current,
      }).dashboardFields,
    )
  }

  const resetCustomPresetTo = useCallback(
    (preset: TThemePresetOption) => {
      if (dsb$.themePreset !== THEME_PRESET.CUSTOM) return

      const { dashboardFields, nextCustomTokensDraft } = buildCustomPresetResetOverwrite(preset)

      clearPendingThemePresetPreviewCommit()
      clearPreviewCssVars()
      updateEditingDetails(true)
      updateShowForkRelation(false)
      updateCustomTokensDraft(nextCustomTokensDraft)

      editThemePresetFields(dashboardFields)
      setPageBgResetVersion((version) => version + 1)
    },
    [
      clearPendingThemePresetPreviewCommit,
      clearPreviewCssVars,
      dsb$,
      editThemePresetFields,
      updateCustomTokensDraft,
      updateEditingDetails,
      updateShowForkRelation,
    ],
  )

  const scheduleThemePresetOverwrite = useCallback(
    (overwrite: TThemePresetOverwrite) => {
      // Keep high-frequency slider drags out of the dashboard store. The preview
      // path already updates CSS vars immediately; touching the store here would
      // re-render the Appearance panel on every pointer move. The eventual
      // debounced commit is still needed so the save bar and draft state catch up.
      updateEditingDetails(true)
      updateShowForkRelation(dsb$.themePreset !== THEME_PRESET.CUSTOM)

      scheduleThemePresetPreviewOverwrite(overwrite)
    },
    [dsb$, scheduleThemePresetPreviewOverwrite, updateEditingDetails, updateShowForkRelation],
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
    // Cancel means the unsaved Custom card preview is gone too. The dashboard
    // store rollback restores persisted fields; this clears the feature-local
    // live token draft that preset selection prefers while editing.
    updateCustomTokensDraft(null)
    setPageBgResetVersion((version) => version + 1)
  }

  // Save-bar placement follows where the edit happened, not whether the active
  // preset is Custom. Custom details edits save under the details panel without
  // showing fork UI; preset-card selections save under the preset list.
  const showDetailsSavingBar = isThemePresetTouched && editingDetails
  const showPresetSavingBar = isThemePresetTouched && !editingDetails

  const pageBgResetKey = `${activePreset}-${isLightTheme ? 'light' : 'dark'}-${pageBgResetVersion}`

  const details: TThemeDetails = {
    selectedTokens,
    selectedPageBgDraft,
    isLightTheme,
    pageBgResetKey,
    onPageBgPreview: previewPageBg,
    onPageBgCommit: scheduleThemePresetOverwrite,
    onThemePresetPreview: previewThemePresetOverwrite,
    onThemePresetSchedule: scheduleThemePresetOverwrite,
    onThemePresetFlush: flushThemePresetPreviewCommit,
    onThemePresetCommit: commitThemePresetOverwrite,
  }

  return {
    activePreset,
    activePresetBase,
    presetOptions,
    customPresetTokens,
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
