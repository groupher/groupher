import type { TWallpaperThemeState } from '~/stores/wallpaper/spec'

export const WALLPAPER_PREVIEW_EVENT = 'groupher:wallpaper-preview'

export type TWallpaperPreviewDetail = {
  state: TWallpaperThemeState | null
}

type TWallpaperPreviewEvent = CustomEvent<TWallpaperPreviewDetail>

export const emitWallpaperPreview = (state: TWallpaperThemeState | null): void => {
  if (typeof window === 'undefined') return

  window.dispatchEvent(
    new CustomEvent<TWallpaperPreviewDetail>(WALLPAPER_PREVIEW_EVENT, {
      detail: { state },
    }),
  )
}

export const subscribeWallpaperPreview = (
  listener: (state: TWallpaperThemeState | null) => void,
): (() => void) => {
  if (typeof window === 'undefined') return () => undefined

  const handlePreview = (event: Event): void => {
    listener((event as TWallpaperPreviewEvent).detail.state)
  }

  window.addEventListener(WALLPAPER_PREVIEW_EVENT, handlePreview)

  return () => window.removeEventListener(WALLPAPER_PREVIEW_EVENT, handlePreview)
}
