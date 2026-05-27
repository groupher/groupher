import { clamp, getLuminance } from '../helper'
import type { TTextureSurface } from '../spec'

export const SCREENTONE_WEBGL_ID = 3

export const SCREENTONE_SHADER_BRANCH = `
  if (uTextureType == ${SCREENTONE_WEBGL_ID}) {
    float cell = mix(8.0, 4.5, strength);
    vec2 center = mod(gl_FragCoord.xy, cell) - cell * 0.5;
    float lum = luminance(color);
    float radius = cell * mix(0.18, 0.42, (1.0 - lum) * strength);
    float dotMask = 1.0 - smoothstep(radius, radius + 0.8, length(center));

    return mix(color, color * 0.64, dotMask * (0.35 + strength * 0.42));
  }
`

/**
 * Draw halftone-style dots based on the source luminance.
 *
 * @example
 * renderScreentoneTexture(ctx, 420, 260, 70, 'preview')
 */
export const renderScreentoneTexture = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number,
  surface: TTextureSurface,
): void => {
  const imageData = ctx.getImageData(0, 0, width, height)
  const step = surface === 'wallpaper' ? 5 : surface === 'preview' ? 6 : 4
  const alpha = (surface === 'wallpaper' ? 0.12 : 0.2) + intensity * 0.0028
  const radius = step * (0.2 + intensity * 0.0018)

  ctx.save()
  ctx.fillStyle = `rgba(118, 110, 100, ${alpha})`
  for (let y = step / 2; y < height; y += step) {
    const offset = Math.floor(y / step) % 2 === 0 ? 0 : step / 2

    for (let x = step / 2 + offset; x < width; x += step) {
      const index = (Math.floor(y) * width + Math.floor(clamp(x, 0, width - 1))) * 4
      const r = imageData.data[index]
      const g = imageData.data[index + 1]
      const b = imageData.data[index + 2]
      const luminance = getLuminance(r, g, b)
      if (luminance > 0.82 && surface === 'wallpaper') continue

      ctx.globalAlpha = alpha * (0.35 + (1 - luminance) * 1.2)
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1
  ctx.restore()
}
