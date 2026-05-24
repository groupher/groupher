import { useCallback, useEffect, useRef } from 'react'

import useDebouncedPreviewCommit from '~/hooks/useDebouncedPreviewCommit'
import useUpdatePreviewCssVars from '~/hooks/useUpdatePreviewCssVars'

import { PREVIEW_CSS_VAR_CLEANUP } from '../constant'
import type { TPageBgDraft } from '../DetailsPanel/CustomPageBg/hooks'
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
 * saveable overwrites are merged and committed after the user pauses.
 *
 * Performance boundary: previewPageBg/previewThemePresetOverwrite must stay
 * DOM/CSS-only. Moving dashboard edits or preset forking into the preview path
 * makes pointer-move interactions re-render the Appearance tree.
 *
 * Example:
 *   const preview = useThemePresetPreview({
 *     selectedTokens,
 *     selectedPageBgDraft,
 *     isLightTheme,
 *     onCommit: (overwrite) => commitThemePresetOverwrite(overwrite),
 *   })
 *
 *   preview.previewThemePresetOverwrite({ glowOpacity: 80 })
 *   preview.scheduleThemePresetOverwrite({ glowOpacity: 80 })
 */
export default function useThemePresetPreview({
  selectedTokens,
  selectedPageBgDraft,
  isLightTheme,
  onCommit,
}: TUseThemePresetPreviewOptions): TUseThemePresetPreviewRet {
  const updatePreviewCssVars = useUpdatePreviewCssVars()
  const selectedTokensRef = useRef(selectedTokens)
  const selectedPageBgDraftRef = useRef(selectedPageBgDraft)
  const {
    schedule: scheduleThemePresetOverwrite,
    flush: flushThemePresetPreviewCommit,
    clear: clearPendingThemePresetPreviewCommit,
  } = useDebouncedPreviewCommit<TThemePresetOverwrite>({ onCommit })

  useEffect(() => {
    selectedTokensRef.current = selectedTokens
    selectedPageBgDraftRef.current = selectedPageBgDraft
  }, [selectedTokens, selectedPageBgDraft])

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
          selectedTokens: selectedTokensRef.current,
          selectedPageBgDraft: selectedPageBgDraftRef.current,
          patch,
          isLightTheme,
        }),
      )
    },
    [isLightTheme, writePreviewCssVars],
  )

  const previewThemePresetOverwrite = useCallback(
    (overwrite: TThemePresetOverwrite) => {
      writePreviewCssVars(
        buildThemePresetPreviewCssVars({
          selectedTokens: selectedTokensRef.current,
          overwrite,
          isLightTheme,
        }),
      )
    },
    [isLightTheme, writePreviewCssVars],
  )

  return {
    previewPageBg,
    previewThemePresetOverwrite,
    scheduleThemePresetOverwrite,
    flushThemePresetPreviewCommit,
    clearPendingThemePresetPreviewCommit,
    clearPreviewCssVars,
  }
}
