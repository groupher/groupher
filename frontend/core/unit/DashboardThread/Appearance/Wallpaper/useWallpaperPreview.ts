import { useCallback, useEffect, useRef } from 'react'

import useDebouncedPreviewCommit from '~/hooks/useDebouncedPreviewCommit'
import useUpdatePreviewCssVars from '~/hooks/useUpdatePreviewCssVars'
import { resolveWallpaper } from '~/hooks/useWallpaper'
import { emitWallpaperPreview } from '~/lib/wallpaperRenderer/preview'
import type { TWallpaperState } from '~/stores/wallpaper/spec'

type TWallpaperPreviewVars = Record<`--${string}`, string | null>

type TOptions = {
  state: TWallpaperState
  onCommit: (patch: Partial<TWallpaperState>) => void
}

const PREVIEW_CSS_VAR_CLEANUP: TWallpaperPreviewVars = {
  '--preview-wallpaper-bg': null,
  '--preview-wallpaper-filter': null,
}

const MAX_BLUR_PX = 6

const buildFilterValue = ({
  blurIntensity = 0,
  brightness = 100,
  saturation = 100,
}: TWallpaperState): string => {
  const safeBlurIntensity = Math.max(0, Math.min(100, blurIntensity))
  const blurPx = Number(((safeBlurIntensity / 100) * MAX_BLUR_PX).toFixed(1))

  return `blur(${blurPx}px) brightness(${brightness}%) saturate(${saturation}%)`
}

const buildPreviewCssVars = (state: TWallpaperState): TWallpaperPreviewVars => {
  const { background } = resolveWallpaper(state, { renderMeshDataUrl: false })

  return {
    '--preview-wallpaper-bg': background || 'transparent',
    '--preview-wallpaper-filter': buildFilterValue(state),
  }
}

export default function useWallpaperPreview({ state, onCommit }: TOptions) {
  const updatePreviewCssVars = useUpdatePreviewCssVars({ selector: 'html' })
  const draftRef = useRef(state)
  const {
    schedule: scheduleWallpaperDraft,
    flush: flushWallpaperDraft,
    clear: clearPendingWallpaperDraft,
  } = useDebouncedPreviewCommit<TWallpaperState>({ onCommit })

  useEffect(() => {
    draftRef.current = state
  }, [state])

  const previewWallpaper = useCallback(
    (patch: Partial<TWallpaperState>) => {
      draftRef.current = {
        ...draftRef.current,
        ...patch,
      }

      updatePreviewCssVars(buildPreviewCssVars(draftRef.current))
      emitWallpaperPreview(draftRef.current)
    },
    [updatePreviewCssVars],
  )

  const scheduleWallpaperPreview = useCallback(
    (patch: Partial<TWallpaperState>) => {
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
