import type { TTextureSurface } from '../spec'

export const PIXELATE_WEBGL_ID = 2

export const PIXELATE_SHADER_UV = `
  if (uTextureType == ${PIXELATE_WEBGL_ID} && uTextureIntensity > 0.001) {
    float blockSize = mix(2.0, 8.0, uTextureIntensity);
    uv = (floor(uv * uResolution / blockSize) + 0.5) * blockSize / uResolution;
  }
`

/**
 * Render blocky pixel sampling by downscaling then redrawing without smoothing.
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
  const blockSize =
    surface === 'wallpaper'
      ? Math.round(2 + intensity * 0.045)
      : surface === 'preview'
        ? Math.round(3 + intensity * 0.07)
        : Math.round(3 + intensity * 0.12)
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

  if (surface !== 'swatch') {
    ctx.globalAlpha = 0.14
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(source, 0, 0, width, height)
    ctx.globalAlpha = 1
  }
  ctx.restore()
}
