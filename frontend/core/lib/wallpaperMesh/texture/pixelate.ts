import { clamp } from '../helper'
import type { TTextureSurface } from '../spec'

export const PIXELATE_WEBGL_ID = 2

const PIXELATE_INTENSITY_SCALE = 0.4

const easePixelateIntensity = (intensity: number): number => {
  const amount = clamp((intensity / 100) * PIXELATE_INTENSITY_SCALE, 0, 1)

  return amount * amount * (3 - 2 * amount)
}

const getBlockSize = (intensity: number, surface: TTextureSurface): number => {
  const amount = easePixelateIntensity(intensity)
  const min = surface === 'wallpaper' ? 4 : surface === 'preview' ? 5 : 6
  const max = surface === 'wallpaper' ? 34 : surface === 'preview' ? 24 : 18

  return Math.round(min + (max - min) * amount)
}

const getColorLevels = (amount: number, surface: TTextureSurface): number => {
  const min = surface === 'swatch' ? 4 : 5
  const max = surface === 'wallpaper' ? 8 : 7

  return Math.round(max - (max - min) * amount)
}

const applyCartoonPalette = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number,
  surface: TTextureSurface,
): void => {
  const amount = easePixelateIntensity(intensity)
  let imageData: ImageData

  try {
    imageData = ctx.getImageData(0, 0, width, height)
  } catch {
    return
  }

  const data = imageData.data
  const levels = getColorLevels(amount, surface)
  const contrast = 1 + amount * 0.22
  const saturation = 1 + amount * 0.28
  const paletteMix = clamp((surface === 'swatch' ? 0.72 : 0.54) + amount * 0.3, 0, 1)

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index] / 255
    const green = data[index + 1] / 255
    const blue = data[index + 2] / 255
    const luminance = red * 0.299 + green * 0.587 + blue * 0.114
    const color = [red, green, blue]

    for (let channel = 0; channel < 3; channel += 1) {
      const saturated = luminance + (color[channel] - luminance) * saturation
      const contrasted = clamp((saturated - 0.5) * contrast + 0.5, 0, 1)
      const quantized = Math.round(contrasted * (levels - 1)) / (levels - 1)
      const cartoon = contrasted * (1 - paletteMix) + quantized * paletteMix

      data[index + channel] = Math.round(clamp(cartoon, 0, 1) * 255)
    }
  }

  ctx.putImageData(imageData, 0, 0)
}

export const PIXELATE_SHADER_UV = `
  if (uTextureType == ${PIXELATE_WEBGL_ID} && uTextureIntensity > 0.001) {
    float pixelStrength = uTextureIntensity * ${PIXELATE_INTENSITY_SCALE.toFixed(1)};
    float pixelAmount = pixelStrength * pixelStrength * (3.0 - 2.0 * pixelStrength);
    float blockSize = mix(2.0, 34.0, pixelAmount);
    uv = (floor(uv * uResolution / blockSize) + 0.5) * blockSize / uResolution;
  }
`

export const PIXELATE_SHADER_BRANCH = `
  if (uTextureType == ${PIXELATE_WEBGL_ID}) {
    float pixelStrength = strength * ${PIXELATE_INTENSITY_SCALE.toFixed(1)};
    float pixelAmount = pixelStrength * pixelStrength * (3.0 - 2.0 * pixelStrength);
    float levels = mix(8.0, 5.0, pixelAmount);
    float lum = luminance(color);
    vec3 saturated = mix(vec3(lum), color, 1.0 + pixelAmount * 0.28);
    vec3 contrasted = clamp((saturated - 0.5) * (1.0 + pixelAmount * 0.22) + 0.5, 0.0, 1.0);
    vec3 quantized = floor(contrasted * (levels - 1.0) + 0.5) / (levels - 1.0);
    float paletteMix = smoothstep(0.02, 0.75, pixelStrength) * mix(0.42, 0.86, pixelAmount);

    return mix(contrasted, quantized, paletteMix);
  }
`

/**
 * Render blocky pixel sampling with palette compression.
 *
 * @example
 * renderPixelateTexture(ctx, sourceCanvas, 420, 260, 45, 'preview')
 */
export const renderPixelateTexture = (
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  width: number,
  height: number,
  intensity: number,
  surface: TTextureSurface,
): void => {
  const amount = easePixelateIntensity(intensity)
  const blockSize = getBlockSize(intensity, surface)
  const sampleWidth = Math.max(1, Math.round(width / blockSize))
  const sampleHeight = Math.max(1, Math.round(height / blockSize))
  const sample = document.createElement('canvas')
  sample.width = sampleWidth
  sample.height = sampleHeight

  const sampleCtx = sample.getContext('2d')
  if (!sampleCtx) return

  sampleCtx.imageSmoothingEnabled = true
  sampleCtx.drawImage(source, 0, 0, sampleWidth, sampleHeight)

  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, width, height)
  ctx.drawImage(sample, 0, 0, sampleWidth, sampleHeight, 0, 0, width, height)
  applyCartoonPalette(ctx, width, height, intensity, surface)

  if (surface !== 'swatch') {
    ctx.globalAlpha = 0.08 * (1 - amount)
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(source, 0, 0, width, height)
    ctx.globalAlpha = 1
  }
  ctx.restore()
}
