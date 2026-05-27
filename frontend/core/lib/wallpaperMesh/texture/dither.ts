import { clamp } from '../helper'
import type { TTextureSurface } from '../spec'

export const DITHER_WEBGL_ID = 4

export const DITHER_SHADER_HELPER = `
float bayer4(vec2 coord) {
  vec2 cell = mod(floor(coord), 4.0);
  float x = cell.x;
  float y = cell.y;

  if (y < 0.5) {
    if (x < 0.5) return 0.0 / 15.0;
    if (x < 1.5) return 8.0 / 15.0;
    if (x < 2.5) return 2.0 / 15.0;
    return 10.0 / 15.0;
  }
  if (y < 1.5) {
    if (x < 0.5) return 12.0 / 15.0;
    if (x < 1.5) return 4.0 / 15.0;
    if (x < 2.5) return 14.0 / 15.0;
    return 6.0 / 15.0;
  }
  if (y < 2.5) {
    if (x < 0.5) return 3.0 / 15.0;
    if (x < 1.5) return 11.0 / 15.0;
    if (x < 2.5) return 1.0 / 15.0;
    return 9.0 / 15.0;
  }

  if (x < 0.5) return 15.0 / 15.0;
  if (x < 1.5) return 7.0 / 15.0;
  if (x < 2.5) return 13.0 / 15.0;
  return 5.0 / 15.0;
}
`

export const DITHER_SHADER_BRANCH = `
  if (uTextureType == ${DITHER_WEBGL_ID}) {
    float threshold = (bayer4(gl_FragCoord.xy) - 0.5) * 0.28 * strength;
    vec3 adjusted = clamp(color + threshold, 0.0, 1.0);
    vec3 quantized = floor(adjusted * 6.0 + 0.5) / 6.0;

    return mix(color, quantized, strength * 0.78);
  }
`

/**
 * Apply ordered Bayer dithering to the current canvas pixels.
 *
 * @example
 * renderDitherTexture(ctx, 420, 260, 55, 'preview')
 */
export const renderDitherTexture = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number,
  surface: TTextureSurface,
): void => {
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  const matrix = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
  const amount = clamp(intensity / 100, 0, 1)
  const levels = surface === 'wallpaper' ? 7 : 5
  const thresholdPower = surface === 'wallpaper' ? 0.11 : 0.18

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      const threshold = (matrix[(y % 4) * 4 + (x % 4)] / 15 - 0.5) * thresholdPower * amount

      for (let channel = 0; channel < 3; channel += 1) {
        const original = data[index + channel]
        const normalized = clamp(original / 255 + threshold, 0, 1)
        const quantized = Math.round(normalized * (levels - 1)) / (levels - 1)
        data[index + channel] = Math.round(
          original * (1 - amount * 0.76) + quantized * 255 * amount * 0.76,
        )
      }
    }
  }

  ctx.putImageData(imageData, 0, 0)
}
