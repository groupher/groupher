import type { CSSProperties } from 'react'

import { WALLPAPER_TYPE } from '~/const/wallpaper'
import { CORE_BG_RENDER_KIND } from '~/lib/coreBg/constant'
import type { TCoreBgConfig, TCoreBgRenderSpec } from '~/lib/coreBg/spec'

/**
 * Builds the CSS fallback input used behind the WebGL CoreBg layer.
 *
 * The renderer draws gradient patterns as a separate opacity-controlled overlay,
 * so the fallback background must be pattern-free to avoid a full-opacity pattern
 * flash before WebGL and the overlay finish painting.
 *
 * @example
 * const renderSpec = resolveCoreBgRenderSpec(bg, getCoreBgRendererFallbackConfig(bg))
 */
export const getCoreBgRendererFallbackConfig = (config: TCoreBgConfig): TCoreBgConfig =>
  config.type === WALLPAPER_TYPE.GRADIENT && config.hasPattern
    ? { ...config, hasPattern: false }
    : config

export const getFallbackStyle = (renderSpec: TCoreBgRenderSpec): CSSProperties => ({
  background: renderSpec.background,
})

// Core background content generation stays in WebGL; visual adjustments stay in CSS.
// CSS filter gives blur/brightness/saturation the same final-layer semantics for
// gradient, mesh, picture, texture effects, and the pattern overlay.
export const getFilterLayerStyle = (renderSpec: TCoreBgRenderSpec): CSSProperties => ({
  filter: `var(--preview-wallpaper-filter, ${renderSpec.filter})`,
})

export const getPatternLayerStyle = (
  renderSpec: TCoreBgRenderSpec,
  patternSize: string,
): CSSProperties => ({
  backgroundColor: renderSpec.patternColor,
  maskImage: `url(${renderSpec.patternImage})`,
  maskRepeat: 'repeat',
  maskSize: patternSize,
  opacity: renderSpec.patternOpacity,
  WebkitMaskImage: `url(${renderSpec.patternImage})`,
  WebkitMaskRepeat: 'repeat',
  WebkitMaskSize: patternSize,
})

export const getVisualIdentity = (renderSpec: TCoreBgRenderSpec): string =>
  [renderSpec.kind, renderSpec.source, renderSpec.imageUrl].join('|')

const canAnimate = (): boolean =>
  typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const shouldCrossfade = (previous: TCoreBgRenderSpec, next: TCoreBgRenderSpec): boolean =>
  canAnimate() && getVisualIdentity(previous) !== getVisualIdentity(next)

export const preloadImage = (renderSpec: TCoreBgRenderSpec): Promise<void> => {
  if (renderSpec.kind !== CORE_BG_RENDER_KIND.IMAGE || !renderSpec.imageUrl)
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
    image.src = renderSpec.imageUrl
  })
}
