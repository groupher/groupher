import { seededRandom } from '../helper'
import type { TTextureSurface } from '../spec'

export const GRAIN_WEBGL_ID = 1

export const GRAIN_SHADER_BRANCH = `
  if (uTextureType == ${GRAIN_WEBGL_ID}) {
    float noise = random(gl_FragCoord.xy + vec2(37.0, 91.0));
    return clamp(color + (noise - 0.5) * strength * 0.22, 0.0, 1.0);
  }
`

/**
 * Draw fine deterministic grain over the current canvas content.
 *
 * @example
 * renderGrainTexture(ctx, 420, 260, 35, 'preview')
 */
export const renderGrainTexture = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number,
  surface: TTextureSurface,
): void => {
  const random = seededRandom(91283)
  const density = surface === 'wallpaper' ? 0.14 : surface === 'preview' ? 0.1 : 0.13
  const count = Math.round(width * height * (density + intensity * 0.00125))
  const lightAlpha = (surface === 'wallpaper' ? 0.045 : 0.06) + intensity * 0.00075
  const darkAlpha = (surface === 'wallpaper' ? 0.012 : 0.018) + intensity * 0.00018

  ctx.save()
  for (let i = 0; i < count; i += 1) {
    const x = Math.floor(random() * width)
    const y = Math.floor(random() * height)
    const isLight = random() > 0.16
    const alpha = (isLight ? lightAlpha : darkAlpha) * (0.35 + random() * 0.65)
    const dotWidth = surface === 'wallpaper' && random() > 0.92 ? 2 : 1

    ctx.fillStyle = isLight ? `rgba(255, 255, 255, ${alpha})` : `rgba(0, 0, 0, ${alpha})`
    ctx.fillRect(x, y, dotWidth, 1)
  }
  ctx.restore()
}
