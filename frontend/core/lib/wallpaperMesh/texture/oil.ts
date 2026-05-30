import { WALLPAPER_TEXTURE_SURFACE } from '../constant'
import { clamp } from '../helper'
import type { TTextureSurface } from '../spec'

export const OIL_WEBGL_ID = 9

const easeOilIntensity = (intensity: number): number => {
  const amount = clamp(intensity / 100, 0, 1)

  return amount * amount * (3 - 2 * amount)
}

export const OIL_SHADER_HELPER = `
vec3 oilCellColor(vec2 cell, float cellPx, float salt) {
  vec2 jitter = vec2(
    random(cell + vec2(17.0 + salt, 71.0)),
    random(cell + vec2(113.0, 29.0 + salt))
  ) - 0.5;
  vec2 center = (cell + vec2(0.5) + jitter * 0.58) * cellPx / uResolution;

  return sampleBase(clamp(center, vec2(0.0), vec2(1.0))).rgb;
}

vec3 oilSoftBlockSample(vec2 uv, float cellPx, float salt) {
  vec2 grid = uv * uResolution / cellPx;
  vec2 cell = floor(grid);
  vec2 local = fract(grid);
  vec2 blend = local * local * (3.0 - 2.0 * local);

  vec3 a = oilCellColor(cell, cellPx, salt);
  vec3 b = oilCellColor(cell + vec2(1.0, 0.0), cellPx, salt);
  vec3 c = oilCellColor(cell + vec2(0.0, 1.0), cellPx, salt);
  vec3 d = oilCellColor(cell + vec2(1.0, 1.0), cellPx, salt);

  return mix(mix(a, b, blend.x), mix(c, d, blend.x), blend.y);
}
`

export const OIL_SHADER_BRANCH = `
  if (uTextureType == ${OIL_WEBGL_ID}) {
    float amount = strength * strength * (3.0 - 2.0 * strength);
    float coarseCell = mix(86.0, 38.0, amount) * textureScale;
    float detailCell = coarseCell * mix(0.42, 0.28, amount);
    vec2 domain = vec2(
      valueNoise(uv * vec2(2.1, 1.7) + vec2(7.0, 19.0)),
      valueNoise(uv * vec2(1.8, 2.3) + vec2(23.0, 5.0))
    ) - 0.5;
    vec2 warpedUv = clamp(uv + domain * coarseCell / uResolution * 0.28, vec2(0.0), vec2(1.0));
    vec3 coarse = oilSoftBlockSample(warpedUv, coarseCell, 0.0);
    vec3 detail = oilSoftBlockSample(warpedUv + domain * detailCell / uResolution * 0.18, detailCell, 41.0);
    vec3 paint = mix(coarse, detail, 0.22 + amount * 0.18);
    float lum = luminance(paint);
    vec3 chroma = paint - vec3(lum);

    paint = clamp(vec3(lum + amount * 0.01) + chroma * (1.04 + amount * 0.1), 0.0, 1.0);

    float mottled = valueNoise(uv * uResolution / max(12.0, detailCell * 0.72) + vec2(13.0, 37.0)) - 0.5;
    vec3 brushed = mix(color, paint, 0.38 + amount * 0.48);
    brushed += mottled * (0.006 + amount * 0.014);

    return clamp(brushed, 0.0, 1.0);
  }
`

const getCellSize = (intensity: number, surface: TTextureSurface): number => {
  const amount = easeOilIntensity(intensity)
  const min =
    surface === WALLPAPER_TEXTURE_SURFACE.WALLPAPER
      ? 34
      : surface === WALLPAPER_TEXTURE_SURFACE.PREVIEW
        ? 22
        : 8
  const max =
    surface === WALLPAPER_TEXTURE_SURFACE.WALLPAPER
      ? 86
      : surface === WALLPAPER_TEXTURE_SURFACE.PREVIEW
        ? 54
        : 18

  return max - (max - min) * amount
}

const drawSoftSampleLayer = (
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  width: number,
  height: number,
  cellSize: number,
  alpha: number,
): void => {
  const doc = source.ownerDocument
  const sample = doc.createElement('canvas')
  const sampleWidth = Math.max(2, Math.round(width / cellSize))
  const sampleHeight = Math.max(2, Math.round(height / cellSize))

  sample.width = sampleWidth
  sample.height = sampleHeight

  const sampleCtx = sample.getContext('2d')
  if (!sampleCtx) return

  sampleCtx.imageSmoothingEnabled = true
  sampleCtx.drawImage(source, 0, 0, width, height, 0, 0, sampleWidth, sampleHeight)

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(sample, 0, 0, sampleWidth, sampleHeight, 0, 0, width, height)
  ctx.restore()
}

/**
 * Re-sample the source into soft, irregular-looking color fields without
 * drawing tile boundaries or adding a noise layer.
 *
 * @example
 * renderOilTexture(ctx, sourceCanvas, 420, 260, 55, WALLPAPER_TEXTURE_SURFACE.PREVIEW)
 */
export const renderOilTexture = (
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  width: number,
  height: number,
  intensity: number,
  surface: TTextureSurface,
): void => {
  const amount = easeOilIntensity(intensity)
  const cellSize = getCellSize(intensity, surface)

  ctx.save()
  ctx.clearRect(0, 0, width, height)
  ctx.imageSmoothingEnabled = true
  ctx.filter = `blur(${1.2 + amount * 2.4}px) saturate(${103 + amount * 10}%) brightness(${100 + amount * 2}%)`
  ctx.drawImage(source, -width * 0.006, -height * 0.006, width * 1.012, height * 1.012)
  ctx.filter = 'none'

  drawSoftSampleLayer(ctx, source, width, height, cellSize, 0.52 + amount * 0.16)
  drawSoftSampleLayer(ctx, source, width, height, cellSize * 0.34, 0.16 + amount * 0.1)

  ctx.globalAlpha = 0.16
  ctx.filter = `blur(${0.7 + amount * 1.1}px)`
  ctx.drawImage(source, 0, 0, width, height)
  ctx.restore()
}
