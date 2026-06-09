import type { CSSProperties } from 'react'

import { BG_RENDER_TYPE } from '~/lib/bg/constant'
import type { TBgRenderSpec } from '~/lib/bg/spec'

export const getFallbackStyle = (renderSpec: TBgRenderSpec): CSSProperties => ({
  background: renderSpec.background,
})

// Core background content generation stays in WebGL; visual adjustments stay in CSS.
// CSS filter gives blur/brightness/saturation the same final-layer semantics for
// gradient, mesh, picture, texture effects, and the pattern overlay.
export const getFilterLayerStyle = (renderSpec: TBgRenderSpec): CSSProperties => ({
  filter: `var(--preview-wallpaper-filter, ${renderSpec.filter})`,
})

export const getPatternLayerStyle = (
  renderSpec: TBgRenderSpec,
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

export const getVisualIdentity = (renderSpec: TBgRenderSpec): string =>
  [renderSpec.type, renderSpec.source, renderSpec.imageUrl].join('|')

const canAnimate = (): boolean =>
  typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const shouldCrossfade = (previous: TBgRenderSpec, next: TBgRenderSpec): boolean =>
  canAnimate() && getVisualIdentity(previous) !== getVisualIdentity(next)

export const preloadImage = (renderSpec: TBgRenderSpec): Promise<void> => {
  if (renderSpec.type !== BG_RENDER_TYPE.IMAGE || !renderSpec.imageUrl) return Promise.resolve()

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
