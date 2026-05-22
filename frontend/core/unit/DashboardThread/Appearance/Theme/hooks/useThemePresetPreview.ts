import { useCallback, useEffect, useRef } from 'react'

import useDebouncedPreviewCommit from '~/hooks/useDebouncedPreviewCommit'
import useUpdatePreviewCssVars from '~/hooks/useUpdatePreviewCssVars'
import type { TPageBgDraft } from '~/widgets/CustomPageBg/hooks'

import { PREVIEW_CSS_VAR_CLEANUP } from '../constant'
import { buildPageBgPreviewCssVars, buildThemePresetPreviewCssVars } from '../helper'
import type {
  TPreviewCssVars,
  TThemePresetOverwrite,
  TUseThemePresetPreviewOptions,
  TUseThemePresetPreviewRet,
} from '../spec'

/**
 * Coordinate realtime theme preview with debounced store commits.
 *
 * Intent: Theme detail controls need immediate visual feedback, but dashboard
 * store writes are saveable/touched state and should not happen on every slider
 * movement. This hook owns that split: CSS vars update immediately, while
 * saveable token patches are merged and committed after the user pauses.
 *
 * Performance boundary: previewPageBg/previewThemePresetPatch must stay
 * DOM/CSS-only. Moving dashboard edits or preset forking into the preview path
 * makes pointer-move interactions re-render the Appearance tree.
 *
 * Example:
 *   const preview = useThemePresetPreview({
 *     selectedOverwrite,
 *     selectedPageBgDraft,
 *     isLightTheme,
 *     onCommit: (patch) => commitThemePresetPatch(patch),
 *   })
 *
 *   preview.previewThemePresetPatch({ glowOpacity: 80 })
 *   preview.scheduleThemePresetPatch({ glowOpacity: 80 })
 */
export default function useThemePresetPreview({
  selectedOverwrite,
  selectedPageBgDraft,
  isLightTheme,
  onCommit,
}: TUseThemePresetPreviewOptions): TUseThemePresetPreviewRet {
  const updatePreviewCssVars = useUpdatePreviewCssVars()
  const selectedOverwriteRef = useRef(selectedOverwrite)
  const selectedPageBgDraftRef = useRef(selectedPageBgDraft)
  const {
    schedule: scheduleThemePresetPatch,
    flush: flushThemePresetPreviewCommit,
    clear: clearPendingThemePresetPreviewCommit,
  } = useDebouncedPreviewCommit<TThemePresetOverwrite>({ onCommit })

  useEffect(() => {
    selectedOverwriteRef.current = selectedOverwrite
    selectedPageBgDraftRef.current = selectedPageBgDraft
  }, [selectedOverwrite, selectedPageBgDraft])

  const writePreviewCssVars = useCallback(
    (vars: TPreviewCssVars) => updatePreviewCssVars(vars),
    [updatePreviewCssVars],
  )

  const clearPreviewCssVars = useCallback(() => {
    writePreviewCssVars(PREVIEW_CSS_VAR_CLEANUP)
  }, [writePreviewCssVars])

  const previewPageBg = useCallback(
    (patch: Partial<TPageBgDraft>) => {
      writePreviewCssVars(
        buildPageBgPreviewCssVars({
          selectedOverwrite: selectedOverwriteRef.current,
          selectedPageBgDraft: selectedPageBgDraftRef.current,
          patch,
          isLightTheme,
        }),
      )
    },
    [isLightTheme, writePreviewCssVars],
  )

  const previewThemePresetPatch = useCallback(
    (patch: Partial<TThemePresetOverwrite>) => {
      writePreviewCssVars(
        buildThemePresetPreviewCssVars({
          selectedOverwrite: selectedOverwriteRef.current,
          patch,
          isLightTheme,
        }),
      )
    },
    [isLightTheme, writePreviewCssVars],
  )

  return {
    previewPageBg,
    previewThemePresetPatch,
    scheduleThemePresetPatch,
    flushThemePresetPreviewCommit,
    clearPendingThemePresetPreviewCommit,
    clearPreviewCssVars,
  }
}
