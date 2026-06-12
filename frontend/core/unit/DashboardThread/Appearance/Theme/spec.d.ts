import type {
  TResolvedThemePreset,
  TThemeName,
  TThemePresetOverwrite,
  TThemePresetOption,
} from '~/spec'
import type { TDsbFieldMap } from '~/stores/dashboard/spec'

import type { TPageBgDraft } from './DetailsPanel/CustomPageBg/hooks'

export type { TThemePresetOption } from '~/spec'

export type TThemePresetCardMode = 'stacked' | 'forkActive' | 'forkBase'

export type TThemePresetTokens = TResolvedThemePreset
export type { TThemePresetOverwrite }

export type TPreviewCssVars = Record<`--${string}`, string | number | null>

export type TCustomPresetEditOptions = {
  activePreset: TThemePresetOption['value']
  activePresetBase: TThemePresetOption['value'] | null
  selectedTokens: TThemePresetTokens
  customTokensDraft: TThemePresetTokens | null
  currentThemeOverwrite: TThemePresetOverwrite | null
  overwrite?: TThemePresetOverwrite
}

export type TPresetSelectionOptions = {
  preset: TThemePresetOption
  currentThemePresetBase: TThemePresetOption['value'] | null
  customTokensDraft: TThemePresetTokens | null
}

export type TPageBgPreviewOptions = {
  selectedTokens: TThemePresetTokens
  selectedPageBgDraft: TPageBgDraft
  patch: Partial<TPageBgDraft>
  themeKey: TThemeName
}

export type TThemePresetPreviewOptions = {
  selectedTokens: TThemePresetTokens
  overwrite: TThemePresetOverwrite
  themeKey: TThemeName
}

export type TUseAppearanceOptions = {
  initialPresetOptions?: readonly TThemePresetOption[]
}

export type TUseThemePresetPreviewOptions = {
  selectedTokens: TThemePresetTokens
  selectedPageBgDraft: TPageBgDraft
  themeKey: TThemeName
  onCommit: (overwrite: TThemePresetOverwrite) => void
}

export type TThemePresetMutationRet = {
  /**
   * Save the current preset draft through the preset-specific API.
   *
   * Intent: keep ThemePreset persistence separate from the generic dashboard
   * mutation hook, including Custom token save, built-in preset selection, demo
   * mode persistence, cache revalidation, and original/touched acceptance.
   *
   * Example:
   *   const { saveThemePreset } = useThemePresetMutation()
   *   saveThemePreset()
   */
  saveThemePreset: () => void
  /**
   * Roll back all preset-owned dashboard fields to their original values.
   *
   * Intent: cancel ThemePreset edits as one field group, covering selected
   * preset, Custom base/tokens, resolved tokens, and sparse overwrite data.
   *
   * Example:
   *   const { rollbackThemePreset } = useThemePresetMutation()
   *   rollbackThemePreset()
   */
  rollbackThemePreset: () => void
}

export type TUseThemePresetPreviewRet = {
  /**
   * Preview page background token changes without committing store state.
   *
   * Intent: page background pickers need immediate CSS feedback while pointer
   * interactions are still in progress.
   *
   * Example:
   *   previewPageBg({ pageBg: '#ffffff' })
   */
  previewPageBg: (patch: Partial<TPageBgDraft>) => void
  /**
   * Preview full theme-token overwrite changes without committing store state.
   *
   * Intent: shared detail controls can preview page background and glow opacity
   * side effects from a single token overwrite.
   *
   * Example:
   *   previewThemePresetOverwrite({ glowOpacity: 80 })
   */
  previewThemePresetOverwrite: (overwrite: TThemePresetOverwrite) => void
  /**
   * Queue a token overwrite for debounced store commit.
   *
   * Intent: keep high-frequency controls responsive while still updating
   * touched/saveable dashboard state after the user pauses.
   *
   * Example:
   *   scheduleThemePresetOverwrite({ gaussBlur: 72 })
   */
  scheduleThemePresetOverwrite: (overwrite: TThemePresetOverwrite) => void
  /**
   * Immediately commit any queued preview patch.
   *
   * Intent: save must persist the latest slider/color value even if the debounce
   * timer has not fired yet.
   *
   * Example:
   *   flushThemePresetPreviewCommit()
   */
  flushThemePresetPreviewCommit: () => void
  /**
   * Drop queued preview patches without committing them.
   *
   * Intent: cancel/select/reset actions should not let an old debounce write
   * stale values back into the dashboard store.
   *
   * Example:
   *   clearPendingThemePresetPreviewCommit()
   */
  clearPendingThemePresetPreviewCommit: () => void
  /**
   * Remove temporary preview CSS variables from the page.
   *
   * Intent: after save, cancel, preset switch, or reset, the committed store
   * values should drive rendering rather than preview-only variables.
   *
   * Example:
   *   clearPreviewCssVars()
   */
  clearPreviewCssVars: () => void
}

export type TUseThemePresetDraftRet = {
  /**
   * Whether any ThemePreset-owned dashboard field differs from original.
   *
   * Intent: Theme UI should ask this semantic question instead of knowing the
   * raw dashboard touched field group.
   *
   * Example:
   *   const { isThemePresetTouched } = useThemePresetDraft()
   *   if (isThemePresetTouched) saveThemePreset()
   */
  isThemePresetTouched: boolean
  /**
   * Edit preset-owned dashboard draft fields.
   *
   * Intent: ThemePreset fields still live in dashboard layout data, but callers
   * should write through this semantic boundary instead of directly coupling to
   * dashboard draft helpers.
   *
   * Example:
   *   editThemePresetFields({ themePreset: THEME_PRESET.CUSTOM, themeTokens })
   */
  editThemePresetFields: (fields: Partial<TDsbFieldMap>) => void
}

export type TThemeDetails = {
  selectedTokens: TThemePresetTokens
  selectedPageBgDraft: TPageBgDraft
  pageBgResetKey: string
  /**
   * Preview page background edits through CSS vars only.
   *
   * Example:
   *   details.onPageBgPreview({ pageBg: '#111111' })
   */
  onPageBgPreview: (patch: Partial<TPageBgDraft>) => void
  /**
   * Schedule page background edits as Custom preset tokens.
   *
   * Example:
   *   details.onPageBgCommit({ pageBg: '#ffffff' })
   */
  onPageBgCommit: (patch: Partial<TPageBgDraft>) => void
  /**
   * Preview token edits through CSS vars only.
   *
   * Example:
   *   details.onThemePresetPreview({ dark: { glowOpacity: 60 } })
   */
  onThemePresetPreview: (overwrite: TThemePresetOverwrite) => void
  /**
   * Schedule token edits as a debounced Custom preset overwrite.
   *
   * Example:
   *   details.onThemePresetSchedule({ light: { textTitle: '#222222' } })
   */
  onThemePresetSchedule: (overwrite: TThemePresetOverwrite) => void
  /**
   * Flush pending token edits before save.
   *
   * Example:
   *   details.onThemePresetFlush()
   */
  onThemePresetFlush: () => void
  /**
   * Commit token edits immediately as Custom preset fields.
   *
   * Example:
   *   details.onThemePresetCommit({ light: { accentColor: '#333333' } })
   */
  onThemePresetCommit: (overwrite: TThemePresetOverwrite) => void
}

export type TUseAppearanceRet = {
  activePreset: TThemePresetOption['value']
  activePresetBase: TThemePresetOption['value']
  presetOptions: readonly TThemePresetOption[]
  customPresetTokens: TThemePresetTokens
  showForkRelation: boolean
  showResetMenu: boolean
  isTouched: boolean
  showDetailsSavingBar: boolean
  showPresetSavingBar: boolean
  details: TThemeDetails
  /**
   * Select a built-in or existing Custom preset card.
   *
   * Intent: update active preset, resolved tokens, and ThemePreset-owned
   * dashboard fields as one batch while clearing any pending realtime preview.
   *
   * Example:
   *   selectPreset(presetOptions[0])
   */
  selectPreset: (preset: TThemePresetOption) => void
  /**
   * Reset the current Custom preset draft to a built-in preset.
   *
   * Intent: keep active preset as Custom, but replace its base/tokens with the
   * chosen readonly preset and force background controls to remount.
   *
   * Example:
   *   resetCustomPresetTo(claudePreset)
   */
  resetCustomPresetTo: (preset: TThemePresetOption) => void
  /**
   * Save the current Appearance theme edits.
   *
   * Intent: flush pending realtime edits, clear preview CSS vars, then run the
   * ThemePreset mutation flow.
   *
   * Example:
   *   saveAppearance()
   */
  saveAppearance: () => void
  /**
   * Cancel the current Appearance theme edits.
   *
   * Intent: discard pending preview patches, clear preview CSS vars, roll back
   * preset-owned fields, and reset background editor local state.
   *
   * Example:
   *   cancelAppearance()
   */
  cancelAppearance: () => void
}

export type TEditDashboardField = <K extends keyof TDsbFieldMap>(
  field: K,
  value: TDsbFieldMap[K],
) => void
