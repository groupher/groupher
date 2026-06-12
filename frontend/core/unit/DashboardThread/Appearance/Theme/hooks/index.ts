import { equals } from 'ramda'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { THEME_PRESET } from '~/const/theme_preset'
import useTheme from '~/hooks/useTheme'
import useThemePreset from '~/hooks/useThemePreset'
import type { TResolvedThemePreset } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import {
  composeCustomPresetEditFields,
  composeCustomPresetResetFields,
  composePresetSelectionFields,
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
  const { theme } = useTheme()
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
  const selectedPageBgDraft = useMemo(() => {
    const activeTokens = selectedTokens[theme]

    return {
      pageBg: activeTokens.pageBg,
      pageBgHue: activeTokens.pageBgHue,
      pageBgIntensity: activeTokens.pageBgIntensity,
    }
  }, [theme, selectedTokens])
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
      updateEditingDetails(true)
      updateShowForkRelation(dsb$.themePreset !== THEME_PRESET.CUSTOM)

      const { dashboardFields, nextCustomTokensDraft } = composeCustomPresetEditFields({
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
    themeKey: theme,
    onCommit: commitThemePresetOverwrite,
  })

  const selectPreset = (preset: TThemePresetOption) => {
    if (preset.value === THEME_PRESET.CUSTOM && !customPresetOption) return

    updateEditingDetails(false)
    updateShowForkRelation(false)
    clearPendingThemePresetPreviewCommit()
    clearPreviewCssVars()

    editThemePresetFields(
      composePresetSelectionFields({
        preset,
        currentThemePresetBase: savedCustomPresetBase,
        customTokensDraft: customTokensDraftRef.current,
      }).dashboardFields,
    )
  }

  const resetCustomPresetTo = useCallback(
    (preset: TThemePresetOption) => {
      if (dsb$.themePreset !== THEME_PRESET.CUSTOM) return

      const { dashboardFields, nextCustomTokensDraft } = composeCustomPresetResetFields(preset)

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
      updateEditingDetails(true)
      updateShowForkRelation(dsb$.themePreset !== THEME_PRESET.CUSTOM)

      scheduleThemePresetPreviewOverwrite(overwrite)
    },
    [dsb$, scheduleThemePresetPreviewOverwrite, updateEditingDetails, updateShowForkRelation],
  )

  const schedulePageBgOverwrite = useCallback(
    (patch) => {
      scheduleThemePresetOverwrite({ [theme]: patch })
    },
    [theme, scheduleThemePresetOverwrite],
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
    updateCustomTokensDraft(null)
    setPageBgResetVersion((version) => version + 1)
  }

  const showDetailsSavingBar = isThemePresetTouched && editingDetails
  const showPresetSavingBar = isThemePresetTouched && !editingDetails

  const pageBgResetKey = `${activePreset}-${theme}-${pageBgResetVersion}`

  const details: TThemeDetails = {
    selectedTokens,
    selectedPageBgDraft,
    pageBgResetKey,
    onPageBgPreview: previewPageBg,
    onPageBgCommit: schedulePageBgOverwrite,
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
