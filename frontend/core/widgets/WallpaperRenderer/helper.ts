import type { CSSProperties } from 'react'

import { WALLPAPER_RENDER_KIND } from '~/lib/wallpaperRenderer/constant'
import type { TWallpaperRenderDescriptor } from '~/lib/wallpaperRenderer/spec'

export const getFallbackStyle = (descriptor: TWallpaperRenderDescriptor): CSSProperties => ({
  background: descriptor.background,
})

// Wallpaper content generation stays in WebGL; global visual adjustments stay in CSS.
// CSS filter gives blur/brightness/saturation the same final-layer semantics for
// gradient, mesh, picture, texture effects, and the pattern overlay.
export const getFilterLayerStyle = (descriptor: TWallpaperRenderDescriptor): CSSProperties => ({
  filter: `var(--preview-wallpaper-filter, ${descriptor.filter})`,
})

export const getPatternLayerStyle = (
  descriptor: TWallpaperRenderDescriptor,
  patternSize: string,
): CSSProperties => ({
  backgroundColor: descriptor.patternColor,
  maskImage: `url(${descriptor.patternImage})`,
  maskRepeat: 'repeat',
  maskSize: patternSize,
  opacity: descriptor.patternOpacity,
  WebkitMaskImage: `url(${descriptor.patternImage})`,
  WebkitMaskRepeat: 'repeat',
  WebkitMaskSize: patternSize,
})

export const getVisualIdentity = (descriptor: TWallpaperRenderDescriptor): string =>
  [descriptor.kind, descriptor.source, descriptor.imageUrl].join('|')

const canAnimate = (): boolean =>
  typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const shouldCrossfade = (
  previous: TWallpaperRenderDescriptor,
  next: TWallpaperRenderDescriptor,
): boolean => canAnimate() && getVisualIdentity(previous) !== getVisualIdentity(next)

export const preloadImage = (descriptor: TWallpaperRenderDescriptor): Promise<void> => {
  if (descriptor.kind !== WALLPAPER_RENDER_KIND.IMAGE || !descriptor.imageUrl)
    return Promise.resolve()

  return new Promise((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      if (!image.decode) {
        resolve()
        return
      }

      image.decode().then(resolve).catch(resolve)
    }
    image.onerror = () => resolve()
    image.src = descriptor.imageUrl
  })
}
