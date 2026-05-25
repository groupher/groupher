import type { TRadialTopGlowBgLayer, TTopGlowBgLayer, TTopGlowEffect } from './spec'

const TEXTURE_GLOW_ALPHA = '82'

const buildRadialLayer = (layer: TRadialTopGlowBgLayer): string =>
  `radial-gradient(${layer.shape ?? 'circle'} at ${layer.x} ${layer.y}, ${layer.color} 0, transparent ${layer.radius})`

const previewGlowColor = (color: string): string => {
  if (!/^#[\dA-Fa-f]{8}$/.test(color)) return color

  return `${color.slice(0, 7)}${TEXTURE_GLOW_ALPHA}`
}

const buildPreviewLayer = (layer: TTopGlowBgLayer): string | null => {
  if (layer.preview === false) return null

  const preview = layer.preview ?? {}
  const previewLayer = {
    ...layer,
    color: previewGlowColor(layer.color),
    x: preview.x ?? layer.x,
    y: preview.y ?? layer.y,
    radius: preview.radius ?? layer.radius,
  }

  return buildRadialLayer(previewLayer)
}

/**
 * Compile a resolved top-glow preset into a CSS `background` value.
 *
 * Intent: rendering components should not know the layer schema. They pass the
 * resolved preset here and receive the final CSS string used by the page glow
 * and modal glow renderers.
 *
 * Example:
 *   style={{ background: buildTopGlowBackground(glow) }}
 */
export const buildTopGlowBackground = (glow: TTopGlowEffect | null): string => {
  if (!glow) return ''

  return glow.layers.map(buildRadialLayer).join(',\n')
}

/**
 * Compile a resolved top-glow preset into the compact preview background used
 * by texture balls.
 *
 * Intent: preset data may provide preview-specific positions or mark layers as
 * `preview: false`, so the selector can stay legible without changing the real
 * page background.
 *
 * Example:
 *   const preview = buildTopGlowPreviewBackground(resolveTopGlow(key, theme))
 */
export const buildTopGlowPreviewBackground = (glow: TTopGlowEffect | null): string => {
  if (!glow) return ''

  return glow.layers.map(buildPreviewLayer).filter(Boolean).join(',\n')
}
