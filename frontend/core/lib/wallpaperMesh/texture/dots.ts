import { clamp, getLuminance } from '../helper'
import type { TTextureSurface } from '../spec'

export const DOTS_WEBGL_ID = 7

const easeDotsIntensity = (intensity: number): number => {
  const amount = clamp(intensity / 100, 0, 1)

  return amount * amount * (3 - 2 * amount)
}

const getCellSize = (surface: TTextureSurface): number => {
  if (surface === 'wallpaper') return 14
  if (surface === 'preview') return 11

  return 8
}

const getDotRadius = (surface: TTextureSurface): number => {
  if (surface === 'wallpaper') return 3.4
  if (surface === 'preview') return 2.75

  return 2.15
}

const hash = (x: number, y: number, salt = 0): number => {
  const value = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453

  return value - Math.floor(value)
}

export const DOTS_SHADER_BRANCH = `
  if (uTextureType == ${DOTS_WEBGL_ID}) {
    float amount = strength * strength * (3.0 - 2.0 * strength);
    float cell = 14.0;
    float row = floor(gl_FragCoord.y / cell);
    float rowOffset = mod(row, 2.0) * cell * 0.5;
    vec2 grid = vec2((gl_FragCoord.x + rowOffset) / cell, gl_FragCoord.y / cell);
    vec2 cellId = floor(grid);
    vec2 local = fract(grid) - 0.5;
    float rowDensity = mix(0.86, 1.12, random(vec2(row, 41.0)));
    float density = clamp(mix(0.08, 0.92, amount) * rowDensity, 0.0, 0.96);
    float keep = step(random(cellId + vec2(17.0, 79.0)), density);
    vec2 centerPx = vec2((cellId.x + 0.5) * cell - rowOffset, (cellId.y + 0.5) * cell);
    vec2 centerUv = clamp(centerPx / uResolution, vec2(0.0), vec2(1.0));
    vec3 sampled = sampleBase(centerUv).rgb;
    float radius = mix(3.0, 3.8, amount) * mix(0.92, 1.08, random(cellId + vec2(61.0, 13.0)));
    float dotMask = 1.0 - smoothstep(radius, radius + 1.05, length(local * cell));
    float alpha = dotMask * keep * (0.58 + amount * 0.2);
    float lum = luminance(sampled);
    vec3 chroma = sampled - vec3(lum);
    vec3 dotColor = clamp(vec3(lum + 0.16 + amount * 0.08) + chroma * (1.12 + amount * 0.22), 0.0, 1.0);

    return mix(color, dotColor, alpha);
  }
`

const sampleRgb = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
): [number, number, number] => {
  const sampleX = Math.floor(clamp(x, 0, width - 1))
  const sampleY = Math.floor(clamp(y, 0, height - 1))
  const index = (sampleY * width + sampleX) * 4

  return [data[index], data[index + 1], data[index + 2]]
}

const deriveDotColor = (
  [red, green, blue]: [number, number, number],
  amount: number,
  alpha: number,
): string => {
  const luminance = getLuminance(red, green, blue)
  const targetLuminance = clamp(luminance + 0.16 + amount * 0.08, 0, 0.96)
  const saturation = 1.12 + amount * 0.22
  const channels = [red, green, blue].map((channel) => {
    const color = channel / 255

    return Math.round(clamp(targetLuminance + (color - luminance) * saturation, 0, 1) * 255)
  })

  return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`
}

/**
 * Draw a regular dotted field where intensity controls the number of visible dots.
 *
 * @example
 * renderDotsTexture(ctx, sourceCanvas, 420, 260, 55, 'preview')
 */
export const renderDotsTexture = (
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  width: number,
  height: number,
  intensity: number,
  surface: TTextureSurface,
): void => {
  const amount = easeDotsIntensity(intensity)
  const cell = getCellSize(surface)
  const radius = getDotRadius(surface)
  const density = 0.08 + amount * 0.84
  const alpha = (surface === 'wallpaper' ? 0.58 : 0.62) + amount * 0.18
  const sourceCtx = source.getContext('2d')
  if (!sourceCtx) return

  let imageData: ImageData
  try {
    imageData = sourceCtx.getImageData(0, 0, width, height)
  } catch {
    return
  }

  ctx.save()
  ctx.globalCompositeOperation = 'source-over'

  for (let y = cell / 2; y < height; y += cell) {
    const row = Math.floor(y / cell)
    const offset = row % 2 === 0 ? 0 : cell / 2
    const rowDensity = clamp(density * (0.86 + hash(row, 41) * 0.26), 0, 0.96)

    for (let x = cell / 2 + offset; x < width; x += cell) {
      const column = Math.floor((x + offset) / cell)
      if (hash(column, row, 17) > rowDensity) continue

      const localRadius = radius * (0.88 + hash(column, row, 61) * 0.22)
      const localAlpha = alpha * (0.78 + hash(column, row, 97) * 0.22)
      ctx.fillStyle = deriveDotColor(
        sampleRgb(imageData.data, width, height, x, y),
        amount,
        localAlpha,
      )
      ctx.beginPath()
      ctx.arc(x, y, localRadius, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  ctx.restore()
}
