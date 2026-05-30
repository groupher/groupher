import { WALLPAPER_TEXTURE_SURFACE } from '../constant'
import { clamp, seededRandom } from '../helper'
import type { TTextureSurface } from '../spec'

export const OIL_WEBGL_ID = 9

const easeOilIntensity = (intensity: number): number => {
  const amount = clamp(intensity / 100, 0, 1)

  return amount * amount * (3 - 2 * amount)
}

export const OIL_SHADER_BRANCH = `
  if (uTextureType == ${OIL_WEBGL_ID}) {
    float amount = strength * strength * (3.0 - 2.0 * strength);
    float spacing = mix(26.0, 92.0, amount) * textureScale;
    vec2 pixel = uv * uResolution;
    float fieldScale = mix(6.0, 2.1, amount);
    float angleSeed = valueNoise(uv * vec2(fieldScale, fieldScale * 0.82) + vec2(47.0, 131.0));
    float bend = valueNoise(uv * vec2(fieldScale * 1.43, fieldScale * 1.18) + vec2(7.0, 23.0)) - 0.5;
    float angle = (angleSeed - 0.5) * 1.18 + bend * 0.46;

    vec2 dir = vec2(cos(angle), sin(angle));
    vec2 drag = dir * spacing / uResolution * mix(0.62, 1.34, amount);
    vec2 side = vec2(-dir.y, dir.x) * spacing / uResolution * mix(0.1, 0.34, amount);
    float pull = valueNoise(uv * vec2(fieldScale * 0.86, fieldScale * 0.72) + vec2(173.0, 59.0)) - 0.5;
    vec2 sourceDrag = drag * (0.72 + pull * 0.56);
    vec3 dragged = color * mix(0.34, 0.18, amount);
    dragged += sampleBase(clamp(uv - sourceDrag * 0.34, vec2(0.0), vec2(1.0))).rgb * 0.18;
    dragged += sampleBase(clamp(uv - sourceDrag * 0.72, vec2(0.0), vec2(1.0))).rgb * 0.17;
    dragged += sampleBase(clamp(uv - sourceDrag * 1.12, vec2(0.0), vec2(1.0))).rgb * 0.14;
    dragged += sampleBase(clamp(uv - sourceDrag * 1.58, vec2(0.0), vec2(1.0))).rgb * mix(0.08, 0.14, amount);
    if (amount > 0.02) {
      dragged += sampleBase(clamp(uv - sourceDrag * 2.08, vec2(0.0), vec2(1.0))).rgb * (0.09 * amount);
    }
    dragged /= mix(0.91, 0.9, amount);

    vec3 paint = dragged;
    if (amount > 0.02) {
      vec3 broadDrag = dragged * 0.72;
      broadDrag += sampleBase(clamp(uv - sourceDrag * 0.62 + side * 0.65, vec2(0.0), vec2(1.0))).rgb * 0.1;
      broadDrag += sampleBase(clamp(uv - sourceDrag * 0.94 - side * 0.72, vec2(0.0), vec2(1.0))).rgb * 0.1;
      broadDrag += sampleBase(clamp(uv - sourceDrag * 1.42 + side * 0.28, vec2(0.0), vec2(1.0))).rgb * 0.08;
      paint = mix(dragged, broadDrag, amount);
    }

    float daub = valueNoise(pixel / max(12.0, spacing * 0.55) + vec2(19.0, 73.0));
    paint = mix(paint, color, 0.1 - amount * 0.06);
    paint *= 0.99 + (daub - 0.5) * 0.045;
    float lum = luminance(paint);
    vec3 chroma = paint - vec3(lum);
    paint = clamp(vec3(lum + amount * 0.008) + chroma * (1.04 + amount * 0.1), 0.0, 1.0);

    return clamp(mix(color, paint, 0.46 + amount * 0.5), 0.0, 1.0);
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

const getStrokeSpacing = (intensity: number, surface: TTextureSurface): number => {
  const amount = easeOilIntensity(intensity)
  const min =
    surface === WALLPAPER_TEXTURE_SURFACE.WALLPAPER
      ? 24
      : surface === WALLPAPER_TEXTURE_SURFACE.PREVIEW
        ? 16
        : 7
  const max =
    surface === WALLPAPER_TEXTURE_SURFACE.WALLPAPER
      ? 86
      : surface === WALLPAPER_TEXTURE_SURFACE.PREVIEW
        ? 54
        : 20

  return min + (max - min) * amount
}

const drawStroke = (
  ctx: CanvasRenderingContext2D,
  red: number,
  green: number,
  blue: number,
  x: number,
  y: number,
  length: number,
  width: number,
  directionX: number,
  directionY: number,
  alpha: number,
): void => {
  const dx = directionX * length * 0.5
  const dy = directionY * length * 0.5

  ctx.globalAlpha = alpha
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = `rgb(${red}, ${green}, ${blue})`
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(x - dx, y - dy)
  ctx.lineTo(x + dx, y + dy)
  ctx.stroke()
}

/**
 * Smear source colors with overlapping soft brush strokes.
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
  const spacing = getStrokeSpacing(intensity, surface)
  const random = seededRandom(69733)
  const sourceCtx = source.getContext('2d')
  if (!sourceCtx) return

  let imageData: ImageData
  try {
    imageData = sourceCtx.getImageData(0, 0, width, height)
  } catch {
    return
  }

  ctx.save()
  ctx.clearRect(0, 0, width, height)
  ctx.imageSmoothingEnabled = true
  ctx.filter = `saturate(${103 + amount * 9}%)`
  ctx.globalAlpha = 0.64 - amount * 0.18
  ctx.drawImage(source, 0, 0, width, height)
  ctx.filter = 'none'
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'

  const step = spacing * (0.48 - amount * 0.1)

  for (let y = -spacing; y < height + spacing; y += step) {
    for (let x = -spacing; x < width + spacing; x += step) {
      const centerX = x + random() * spacing
      const centerY = y + random() * spacing
      const sampleOffset = spacing * (0.45 + amount * 1.45)
      const mostlyHorizontal = random() > 0.18
      const angle =
        (random() - 0.5) * 1.1 + (mostlyHorizontal ? 0 : Math.PI * 0.5 * (random() > 0.5 ? 1 : -1))
      const directionX = Math.cos(angle)
      const directionY = Math.sin(angle)
      const sampleX = centerX - directionX * sampleOffset
      const sampleY = centerY - directionY * sampleOffset
      const [red, green, blue] = sampleRgb(imageData.data, width, height, sampleX, sampleY)
      const length = spacing * (1.6 + random() * 1.45) * (0.92 + amount * 0.34)
      const strokeWidth = spacing * (0.34 + random() * 0.34)

      drawStroke(
        ctx,
        red,
        green,
        blue,
        centerX,
        centerY,
        length,
        strokeWidth,
        directionX,
        directionY,
        0.22 + amount * 0.22,
      )
    }
  }

  ctx.globalAlpha = 0.12 - amount * 0.07
  ctx.filter = 'none'
  ctx.drawImage(source, 0, 0, width, height)
  ctx.restore()
}
