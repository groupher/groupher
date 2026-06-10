import { useCallback, useEffect, useRef } from 'react'

import useDebouncedPreviewCommit from '~/hooks/useDebouncedPreviewCommit'
import useUpdatePreviewCssVars from '~/hooks/useUpdatePreviewCssVars'
import { composeWallpaperBgCss } from '~/hooks/useWallpaper'
import { emitWallpaperPreview } from '~/lib/wallpaperPreview'
import type { TWallpaperThemeState } from '~/stores/wallpaper/spec'

type TWallpaperPreviewVars = Record<`--${string}`, string | null>

type TOptions = {
  state: TWallpaperThemeState
  onCommit: (patch: Partial<TWallpaperThemeState>) => void
}

const PREVIEW_CSS_VAR_CLEANUP: TWallpaperPreviewVars = {
  '--preview-wallpaper-bg': null,
  '--preview-wallpaper-filter': null,
}

const MAX_BLUR_PX = 6

/**
 * Compose the live preview filter value from the active wallpaper state.
 *
 * @example
 * const filter = composeFilterValue(state)
 */
const composeFilterValue = ({
  blurIntensity = 0,
  brightness = 100,
  saturation = 100,
}: TWallpaperThemeState): string => {
  const safeBlurIntensity = Math.max(0, Math.min(100, blurIntensity))
  const blurPx = Number(((safeBlurIntensity / 100) * MAX_BLUR_PX).toFixed(1))

  return `blur(${blurPx}px) brightness(${brightness}%) saturate(${saturation}%)`
}

/**
 * Compose the CSS variable patch used by the dashboard wallpaper live preview.
 *
 * @example
 * updatePreviewCssVars(composePreviewCssVars(draft))
 */
const composePreviewCssVars = (state: TWallpaperThemeState): TWallpaperPreviewVars => {
  const { background } = composeWallpaperBgCss(state)

  return {
    '--preview-wallpaper-bg': background || 'transparent',
    '--preview-wallpaper-filter': composeFilterValue(state),
  }
}

export default function useWallpaperPreview({ state, onCommit }: TOptions) {
  const updatePreviewCssVars = useUpdatePreviewCssVars({ selector: 'html' })
  const draftRef = useRef(state)
  const {
    schedule: scheduleWallpaperDraft,
    flush: flushWallpaperDraft,
    clear: clearPendingWallpaperDraft,
  } = useDebouncedPreviewCommit<TWallpaperThemeState>({ onCommit })

  useEffect(() => {
    draftRef.current = state
  }, [state])

  const previewWallpaper = useCallback(
    (patch: Partial<TWallpaperThemeState>) => {
      draftRef.current = {
        ...draftRef.current,
        ...patch,
      }

      updatePreviewCssVars(composePreviewCssVars(draftRef.current))
      emitWallpaperPreview(draftRef.current)
    },
    [updatePreviewCssVars],
  )

  const scheduleWallpaperPreview = useCallback(
    (patch: Partial<TWallpaperThemeState>) => {
      previewWallpaper(patch)
      scheduleWallpaperDraft(patch)
    },
    [previewWallpaper, scheduleWallpaperDraft],
  )

  const clearWallpaperPreview = useCallback(() => {
    updatePreviewCssVars(PREVIEW_CSS_VAR_CLEANUP)
    emitWallpaperPreview(null)
  }, [updatePreviewCssVars])

  return {
    previewWallpaper,
    scheduleWallpaperPreview,
    flushWallpaperDraft,
    clearPendingWallpaperDraft,
    clearWallpaperPreview,
  }
}
