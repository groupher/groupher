import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import THEME from '~/const/theme'
import { getPageBgCustomColor, normalizePageBgHue, normalizePageBgIntensity } from '~/lib/color'
import { THEME_PRESET_PAGE_BG_CSS_VAR } from '~/lib/themePreset'

export type TPageBgDraft = {
  pageBg: string
  pageBgHue: number
  pageBgIntensity: number
}

type TPageBgPatchHandler = (patch: Partial<TPageBgDraft>) => void
type TThemeName = typeof THEME.LIGHT | typeof THEME.DARK

type TUseCustomPageBgControlsArgs = {
  draft: TPageBgDraft
  theme: TThemeName
  onDraftChange: TPageBgPatchHandler
  onPreviewPatch?: TPageBgPatchHandler
  onScheduleCommitPatch?: TPageBgPatchHandler
  onImmediateCommitPatch?: TPageBgPatchHandler
}

export const resolveRawBg = (draft: TPageBgDraft) => draft.pageBg || THEME_PRESET_PAGE_BG_CSS_VAR

const getThemePageBgState = (draft: TPageBgDraft) => {
  const color = draft.pageBg
  const hue = normalizePageBgHue(draft.pageBgHue)
  const intensity = normalizePageBgIntensity(draft.pageBgIntensity)

  return { color, hue, intensity }
}

const resolveCustomPatch = (theme: TThemeName, hue: number, intensity: number) => {
  const safeHue = normalizePageBgHue(hue)
  const safeIntensity = normalizePageBgIntensity(intensity)

  return {
    pageBg: getPageBgCustomColor(theme, safeHue, safeIntensity),
    pageBgHue: safeHue,
    pageBgIntensity: safeIntensity,
  } as Partial<TPageBgDraft>
}

export const useCustomPageBgControls = ({
  draft,
  theme,
  onDraftChange,
  onPreviewPatch,
  onScheduleCommitPatch,
  onImmediateCommitPatch,
}: TUseCustomPageBgControlsArgs) => {
  const { color, hue, intensity } = useMemo(() => getThemePageBgState(draft), [draft])
  const hasPreviewPatch = !!onPreviewPatch
  const [localHue, setLocalHue] = useState(hue)
  const [localIntensity, setLocalIntensity] = useState(intensity)
  // Slider drags can emit hue and intensity changes independently. Refs keep
  // the latest counterpart value available without waiting for React state to
  // flush, so generated patches never mix a fresh value with stale props.
  const hueRef = useRef(hue)
  const intensityRef = useRef(intensity)

  useEffect(() => {
    // External draft updates, theme switches, and explicit reset keys must pull
    // the local preview buffer back to the saveable draft values.
    setLocalHue(hue)
    setLocalIntensity(intensity)
    hueRef.current = hue
    intensityRef.current = intensity
  }, [hue, intensity, theme])

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

  const handleToggleChange = useCallback(() => {
    onDraftChange({ pageBg: color })
  }, [color, onDraftChange, theme])

  return {
    checked: true,
    displayHue: hasPreviewPatch ? localHue : hue,
    displayIntensity: hasPreviewPatch ? localIntensity : intensity,
    hueResetValue: hue,
    handleHueChange,
    handleIntensityChange,
    handleIntensityCommit,
    handleToggleChange,
  }
}
