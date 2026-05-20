import { useCallback, useEffect, useRef, useState } from 'react'

import { COLOR, PAGE_BG_COLOR_HEX, PAGE_BG_DEFAULT } from '~/const/colors'
import THEME from '~/const/theme'
import { getPageBgCustomColor, getPageBgCustomParamsFromHex } from '~/lib/color'

import { COLORED_PAGE_BG, PAGE_BG_THEME_FIELDS, SOLARIZED_PAGE_BG } from './constant'

export type TPageBgDraft = {
  pageBg: string
  pageBgDark: string
  pageCustomBg: number
  pageCustomBgDark: number
  pageCustomIntensity: number
  pageCustomIntensityDark: number
}

type TPageBgPatchHandler = (patch: Partial<TPageBgDraft>) => void

type TUseCustomPageBgControlsArgs = {
  draft: TPageBgDraft
  originalDraft: TPageBgDraft
  theme: string
  onDraftChange: TPageBgPatchHandler
  onPreviewPatch?: TPageBgPatchHandler
  onScheduleCommitPatch?: TPageBgPatchHandler
  onImmediateCommitPatch?: TPageBgPatchHandler
}

export const resolveRawBg = (draft: TPageBgDraft, isLightTheme: boolean) => {
  const currentPageBg = isLightTheme ? draft.pageBg : draft.pageBgDark

  if (currentPageBg === COLOR.CUSTOM) {
    return isLightTheme
      ? getPageBgCustomColor(THEME.LIGHT, draft.pageCustomBg, draft.pageCustomIntensity)
      : getPageBgCustomColor(THEME.DARK, draft.pageCustomBgDark, draft.pageCustomIntensityDark)
  }

  return PAGE_BG_COLOR_HEX[currentPageBg] || ''
}

const resolveInitialPreset = (current: string, original: string, fallback: string): string => {
  if (current !== COLOR.CUSTOM) return current
  if (original !== COLOR.CUSTOM) return original
  return fallback
}

export const resolveLastPresetByTheme = (draft: TPageBgDraft, originalDraft: TPageBgDraft) => ({
  light: resolveInitialPreset(draft.pageBg, originalDraft.pageBg, PAGE_BG_DEFAULT[THEME.LIGHT]),
  dark: resolveInitialPreset(
    draft.pageBgDark,
    originalDraft.pageBgDark,
    PAGE_BG_DEFAULT[THEME.DARK],
  ),
})

export const getThemePageBgState = (draft: TPageBgDraft, theme: string) => {
  const { pageBg, pageCustomBg, pageCustomIntensity } = PAGE_BG_THEME_FIELDS[theme]

  return {
    pageBg: draft[pageBg],
    pageCustomBg: draft[pageCustomBg],
    pageCustomIntensity: draft[pageCustomIntensity],
  }
}

export const resolveCustomInitPatch = (draft: TPageBgDraft, theme: string) => {
  const { pageBg } = getThemePageBgState(draft, theme)
  if (pageBg === COLOR.CUSTOM) return null

  // Switching a preset background to custom should preserve the user's visual
  // starting point. Only color-capable presets can be reverse-mapped reliably;
  // otherwise fall back to the theme's solarized preset as the neutral source.
  const fallbackPresetBg = SOLARIZED_PAGE_BG[theme]
  const sourcePresetBg = COLORED_PAGE_BG[theme].has(pageBg) ? pageBg : fallbackPresetBg
  const sourceHex = PAGE_BG_COLOR_HEX[sourcePresetBg] || PAGE_BG_COLOR_HEX[fallbackPresetBg]
  const { hue, intensity } = getPageBgCustomParamsFromHex(sourceHex, theme)
  const { pageBg: pageBgField, pageCustomBg, pageCustomIntensity } = PAGE_BG_THEME_FIELDS[theme]

  return {
    [pageBgField]: COLOR.CUSTOM,
    [pageCustomBg]: hue,
    [pageCustomIntensity]: intensity,
  } as Partial<TPageBgDraft>
}

export const resolvePresetRestorePatch = (lightPreset: string, darkPreset: string) => ({
  pageBg: lightPreset,
  pageBgDark: darkPreset,
})

export const resolveCustomPatch = (theme: string, hue: number, intensity: number) => {
  const { pageBg, pageCustomBg, pageCustomIntensity } = PAGE_BG_THEME_FIELDS[theme]

  return {
    [pageBg]: COLOR.CUSTOM,
    [pageCustomBg]: hue,
    [pageCustomIntensity]: intensity,
  } as Partial<TPageBgDraft>
}

export const useCustomPageBgControls = ({
  draft,
  originalDraft,
  theme,
  onDraftChange,
  onPreviewPatch,
  onScheduleCommitPatch,
  onImmediateCommitPatch,
}: TUseCustomPageBgControlsArgs) => {
  const {
    pageBg,
    pageCustomBg: hue,
    pageCustomIntensity: intensity,
  } = getThemePageBgState(draft, theme)
  const checked = draft.pageBg === COLOR.CUSTOM || draft.pageBgDark === COLOR.CUSTOM
  const hasPreviewPatch = !!onPreviewPatch
  const [localHue, setLocalHue] = useState(hue)
  const [localIntensity, setLocalIntensity] = useState(intensity)
  // Slider drags can emit hue and intensity changes independently. Refs keep
  // the latest counterpart value available without waiting for React state to
  // flush, so generated patches never mix a fresh value with stale props.
  const hueRef = useRef(hue)
  const intensityRef = useRef(intensity)
  // When custom mode is disabled, restore the most recent non-custom preset for
  // each theme. This ref is intentionally not state: changing it should not
  // re-render the control while users browse presets elsewhere.
  const lastPresetByThemeRef = useRef(resolveLastPresetByTheme(draft, originalDraft))

  useEffect(() => {
    // External draft updates, theme switches, and explicit reset keys must pull
    // the local preview buffer back to the saveable draft values.
    setLocalHue(hue)
    setLocalIntensity(intensity)
    hueRef.current = hue
    intensityRef.current = intensity
  }, [hue, intensity, theme])

  useEffect(() => {
    if (draft.pageBg !== COLOR.CUSTOM) {
      lastPresetByThemeRef.current.light = draft.pageBg
    }

    if (draft.pageBgDark !== COLOR.CUSTOM) {
      lastPresetByThemeRef.current.dark = draft.pageBgDark
    }
  }, [draft.pageBg, draft.pageBgDark])

  const initCurrentThemeCustom = useCallback(() => {
    // Toggle-on and theme switching both funnel through this path so the active
    // theme is initialized exactly once from its current preset.
    const patch = resolveCustomInitPatch(draft, theme)
    if (patch) onDraftChange(patch)
  }, [draft, onDraftChange, theme])

  const applyCustomPatch = useCallback(
    (patch: Partial<TPageBgDraft>) => {
      // Preview mode is used by high-frequency controls. It updates CSS vars
      // immediately and schedules the saveable draft separately, avoiding parent
      // React renders on every pointer move while preserving saving semantics.
      if (onPreviewPatch) {
        onPreviewPatch(patch)
        onScheduleCommitPatch?.(patch)
        return
      }

      onDraftChange(patch)
    },
    [onDraftChange, onPreviewPatch, onScheduleCommitPatch],
  )

  const handleHueChange = useCallback(
    (value: number) => {
      hueRef.current = value
      setLocalHue(value)
      applyCustomPatch(resolveCustomPatch(theme, value, intensityRef.current))
    },
    [applyCustomPatch, theme],
  )

  const handleIntensityChange = useCallback(
    (value: number) => {
      intensityRef.current = value
      setLocalIntensity(value)
      applyCustomPatch(resolveCustomPatch(theme, hueRef.current, value))
    },
    [applyCustomPatch, theme],
  )

  const handleIntensityCommit = useCallback(
    (value: number) => {
      // RangeInput reports a final boundary on pointer-up/blur/keyboard commit.
      // Force that exact value into the refs and local buffer before flushing an
      // immediate save patch so the persisted state matches the visible thumb.
      intensityRef.current = value
      setLocalIntensity(value)
      const patch = resolveCustomPatch(theme, hueRef.current, value)
      onImmediateCommitPatch?.(patch)
      onScheduleCommitPatch?.(patch)
    },
    [onImmediateCommitPatch, onScheduleCommitPatch, theme],
  )

  const handleToggleChange = useCallback(
    (nextChecked: boolean) => {
      if (nextChecked) {
        initCurrentThemeCustom()
        return
      }

      onDraftChange(
        resolvePresetRestorePatch(
          lastPresetByThemeRef.current.light,
          lastPresetByThemeRef.current.dark,
        ),
      )
    },
    [initCurrentThemeCustom, onDraftChange],
  )

  useEffect(() => {
    if (!checked) return
    if (pageBg === COLOR.CUSTOM) return

    // Custom can be enabled while viewing the opposite theme. If the user later
    // switches themes while custom mode is globally on, lazily initialize the
    // newly active theme from its own preset instead of reusing the other theme's
    // hue/intensity values.
    initCurrentThemeCustom()
  }, [checked, initCurrentThemeCustom, pageBg])

  return {
    checked,
    displayHue: hasPreviewPatch ? localHue : hue,
    displayIntensity: hasPreviewPatch ? localIntensity : intensity,
    hueResetValue: hue,
    handleHueChange,
    handleIntensityChange,
    handleIntensityCommit,
    handleToggleChange,
  }
}
