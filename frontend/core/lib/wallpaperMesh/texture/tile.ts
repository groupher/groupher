import { clamp } from '../helper'
import type { TTextureSurface } from '../spec'

export const TILE_WEBGL_ID = 8

const easeTileIntensity = (intensity: number): number => {
  const amount = clamp(intensity / 100, 0, 1)

  return amount * amount * (3 - 2 * amount)
}

const getTileSize = (intensity: number, surface: TTextureSurface): number => {
  const amount = easeTileIntensity(intensity)
  const min = surface === 'wallpaper' ? 8 : surface === 'preview' ? 7 : 6
  const max = surface === 'wallpaper' ? 30 : surface === 'preview' ? 24 : 17

  return Math.round(min + (max - min) * amount)
}

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void => {
  const safeRadius = Math.min(radius, width / 2, height / 2)

  ctx.beginPath()
  ctx.moveTo(x + safeRadius, y)
  ctx.lineTo(x + width - safeRadius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius)
  ctx.lineTo(x + width, y + height - safeRadius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height)
  ctx.lineTo(x + safeRadius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius)
  ctx.lineTo(x, y + safeRadius)
  ctx.quadraticCurveTo(x, y, x + safeRadius, y)
  ctx.closePath()
}

export const TILE_SHADER_UV = ''

export const TILE_SHADER_BRANCH = `
  if (uTextureType == ${TILE_WEBGL_ID}) {
    float tileAmount = strength * strength * (3.0 - 2.0 * strength);
    float tileHeight = max(3.0, mix(8.0, 30.0, tileAmount) * textureScale);
    float tileWidth = tileHeight * 0.72;
    vec2 tileSize = vec2(tileWidth, tileHeight);
    vec2 grid = uv * uResolution / tileSize;
    vec2 cell = floor(grid);
    vec2 local = fract(grid) * tileSize;
    vec2 center = tileSize * 0.5;
    vec2 halfSize = tileSize * 0.5 - vec2(mix(0.45, 1.05, tileAmount));
    float radius = min(tileHeight * 0.14, min(halfSize.x, halfSize.y));
    vec2 q = abs(local - center) - (halfSize - vec2(radius));
    float roundedRect = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
    float tileMask = 1.0 - smoothstep(-0.25, 0.75, roundedRect);
    vec2 tileUv = clamp((cell + vec2(0.5)) * tileSize / uResolution, vec2(0.0), vec2(1.0));
    vec3 tileColor = sampleBase(tileUv).rgb;
    vec3 grout = color * (0.5 + strength * 0.08);

    return mix(grout, tileColor, tileMask);
  }
`

/**
 * Render single-color rounded tiles sampled from the source wallpaper.
 *
 * @example
 * renderTileTexture(ctx, sourceCanvas, 420, 260, 55, 'preview')
 */
export const renderTileTexture = (
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  width: number,
  height: number,
  intensity: number,
  surface: TTextureSurface,
): void => {
  const amount = easeTileIntensity(intensity)
  const tileHeight = getTileSize(intensity, surface)
  const tileWidth = Math.round(tileHeight * 0.72)
  const gap = clamp(
    tileHeight * 0.04,
    surface === 'swatch' ? 0.5 : 0.7,
    surface === 'wallpaper' ? 1.1 : 1,
  )
  const sampleWidth = Math.max(1, Math.ceil(width / tileWidth))
  const sampleHeight = Math.max(1, Math.ceil(height / tileHeight))
  const sample = document.createElement('canvas')
  sample.width = sampleWidth
  sample.height = sampleHeight

  const sampleCtx = sample.getContext('2d')
  if (!sampleCtx) return

  sampleCtx.imageSmoothingEnabled = true
  sampleCtx.drawImage(source, 0, 0, width, height, 0, 0, sampleWidth, sampleHeight)

  let pixels: Uint8ClampedArray
  try {
    pixels = sampleCtx.getImageData(0, 0, sampleWidth, sampleHeight).data
  } catch {
    ctx.drawImage(source, 0, 0, width, height)
    return
  }

  ctx.save()
  ctx.clearRect(0, 0, width, height)
  ctx.drawImage(source, 0, 0, width, height)
  ctx.fillStyle = `rgba(18, 18, 18, ${(surface === 'wallpaper' ? 0.2 : 0.24) + amount * 0.08})`
  ctx.fillRect(0, 0, width, height)

  for (let row = 0; row < sampleHeight; row += 1) {
    const y = row * tileHeight
    const tileDrawHeight = Math.min(tileHeight, height - y)

    for (let column = 0; column < sampleWidth; column += 1) {
      const x = column * tileWidth
      const tileDrawWidth = Math.min(tileWidth, width - x)
      const pixelIndex = (row * sampleWidth + column) * 4
      const red = pixels[pixelIndex]
      const green = pixels[pixelIndex + 1]
      const blue = pixels[pixelIndex + 2]
      const alpha = pixels[pixelIndex + 3] / 255
      const rectWidth = Math.max(1, tileDrawWidth - gap)
      const rectHeight = Math.max(1, tileDrawHeight - gap)

      ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`
      drawRoundedRect(
        ctx,
        x + gap / 2,
        y + gap / 2,
        rectWidth,
        rectHeight,
        Math.min(rectWidth, rectHeight) * 0.14,
      )
      ctx.fill()
    }
  }

  ctx.restore()
}
