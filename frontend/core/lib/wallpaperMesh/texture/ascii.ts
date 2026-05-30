import { WALLPAPER_TEXTURE_SURFACE } from '../constant'
import { clamp, getLuminance } from '../helper'
import type { TTextureSurface } from '../spec'

export const ASCII_WEBGL_ID = 6

const ASCII_GLYPHS = ['-', '=', '+', 'x', 'X', '8', '#', '@'] as const

const easeAsciiIntensity = (intensity: number): number => {
  const amount = clamp(intensity / 100, 0, 1)

  return amount * amount * (3 - 2 * amount)
}

const getCellSize = (
  intensity: number,
  surface: TTextureSurface,
): { width: number; height: number } => {
  const amount = easeAsciiIntensity(intensity)
  const minWidth =
    surface === WALLPAPER_TEXTURE_SURFACE.WALLPAPER
      ? 8
      : surface === WALLPAPER_TEXTURE_SURFACE.PREVIEW
        ? 7
        : 6
  const maxWidth =
    surface === WALLPAPER_TEXTURE_SURFACE.WALLPAPER
      ? 14
      : surface === WALLPAPER_TEXTURE_SURFACE.PREVIEW
        ? 11
        : 9
  const minHeight =
    surface === WALLPAPER_TEXTURE_SURFACE.WALLPAPER
      ? 12
      : surface === WALLPAPER_TEXTURE_SURFACE.PREVIEW
        ? 10
        : 8
  const maxHeight =
    surface === WALLPAPER_TEXTURE_SURFACE.WALLPAPER
      ? 18
      : surface === WALLPAPER_TEXTURE_SURFACE.PREVIEW
        ? 14
        : 11

  return {
    width: Math.round(maxWidth - (maxWidth - minWidth) * amount),
    height: Math.round(maxHeight - (maxHeight - minHeight) * amount),
  }
}

const pickGlyph = (luminance: number): string => {
  const index = Math.min(ASCII_GLYPHS.length - 1, Math.floor(luminance * ASCII_GLYPHS.length))

  return ASCII_GLYPHS[index] ?? '@'
}

const readPixel = (
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

/**
 * Draw an ASCII glyph field sampled from the current wallpaper luminance.
 *
 * @example
 * renderAsciiTexture(ctx, sourceCanvas, 420, 260, 65, WALLPAPER_TEXTURE_SURFACE.PREVIEW)
 */
export const renderAsciiTexture = (
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  width: number,
  height: number,
  intensity: number,
  surface: TTextureSurface,
): void => {
  const amount = easeAsciiIntensity(intensity)
  const sourceCtx = source.getContext('2d')
  if (!sourceCtx) return

  let imageData: ImageData
  try {
    imageData = sourceCtx.getImageData(0, 0, width, height)
  } catch {
    return
  }

  const cell = getCellSize(intensity, surface)
  const fontSize = Math.round(
    cell.height * (surface === WALLPAPER_TEXTURE_SURFACE.SWATCH ? 0.95 : 1.02),
  )
  const alphaBase = (surface === WALLPAPER_TEXTURE_SURFACE.WALLPAPER ? 0.24 : 0.3) + amount * 0.48
  const boost = 46 + amount * 92

  ctx.save()
  ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (let y = cell.height / 2; y < height; y += cell.height) {
    for (let x = cell.width / 2; x < width; x += cell.width) {
      const [red, green, blue] = readPixel(imageData.data, width, height, x, y)
      const luminance = getLuminance(red, green, blue)
      const glyph = pickGlyph(luminance)
      const alpha = alphaBase * (0.32 + luminance * 0.78)

      ctx.fillStyle = `rgba(${Math.round(clamp(red + boost, 0, 255))}, ${Math.round(
        clamp(green + boost, 0, 255),
      )}, ${Math.round(clamp(blue + boost, 0, 255))}, ${clamp(alpha, 0, 0.95)})`
      ctx.fillText(glyph, x, y + cell.height * 0.03)
    }
  }

  ctx.restore()
}

export const ASCII_SHADER_HELPER = `
float asciiLine(vec2 point, vec2 start, vec2 end, float width) {
  vec2 pa = point - start;
  vec2 ba = end - start;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);

  return 1.0 - smoothstep(width, width + 0.035, length(pa - ba * h));
}

float asciiCircle(vec2 point, vec2 center, float radius, float width) {
  return 1.0 - smoothstep(width, width + 0.035, abs(length(point - center) - radius));
}

float asciiDot(vec2 point, vec2 center, float radius) {
  return 1.0 - smoothstep(radius, radius + 0.035, length(point - center));
}

float asciiGlyph(float glyph, vec2 point) {
  float thin = 0.045;
  float medium = 0.06;

  if (glyph < 0.5) {
    return asciiLine(point, vec2(0.22, 0.56), vec2(0.78, 0.56), medium);
  }

  if (glyph < 1.5) {
    return max(
      asciiLine(point, vec2(0.22, 0.42), vec2(0.78, 0.42), thin),
      asciiLine(point, vec2(0.22, 0.64), vec2(0.78, 0.64), thin)
    );
  }

  if (glyph < 2.5) {
    return max(
      asciiLine(point, vec2(0.22, 0.52), vec2(0.78, 0.52), medium),
      asciiLine(point, vec2(0.5, 0.22), vec2(0.5, 0.82), medium)
    );
  }

  if (glyph < 3.5) {
    return max(
      asciiLine(point, vec2(0.28, 0.28), vec2(0.72, 0.72), medium),
      asciiLine(point, vec2(0.72, 0.28), vec2(0.28, 0.72), medium)
    );
  }

  if (glyph < 4.5) {
    float diagonal = max(
      asciiLine(point, vec2(0.18, 0.18), vec2(0.82, 0.82), medium),
      asciiLine(point, vec2(0.82, 0.18), vec2(0.18, 0.82), medium)
    );

    return max(diagonal, asciiLine(point, vec2(0.2, 0.5), vec2(0.8, 0.5), thin));
  }

  if (glyph < 5.5) {
    float top = asciiCircle(point, vec2(0.5, 0.34), 0.2, thin);
    float bottom = asciiCircle(point, vec2(0.5, 0.68), 0.22, thin);

    return max(max(top, bottom), asciiLine(point, vec2(0.3, 0.51), vec2(0.7, 0.51), thin));
  }

  if (glyph < 6.5) {
    float horizontal = max(
      asciiLine(point, vec2(0.16, 0.38), vec2(0.84, 0.38), thin),
      asciiLine(point, vec2(0.16, 0.64), vec2(0.84, 0.64), thin)
    );
    float vertical = max(
      asciiLine(point, vec2(0.36, 0.18), vec2(0.28, 0.84), thin),
      asciiLine(point, vec2(0.66, 0.18), vec2(0.58, 0.84), thin)
    );

    return max(horizontal, vertical);
  }

  float ring = asciiCircle(point, vec2(0.5, 0.52), 0.3, thin);
  float center = asciiDot(point, vec2(0.5, 0.54), 0.08);
  float tail = asciiLine(point, vec2(0.61, 0.56), vec2(0.8, 0.78), thin);

  return max(max(ring, center), tail);
}
`

export const ASCII_SHADER_BRANCH = `
  if (uTextureType == ${ASCII_WEBGL_ID}) {
    vec2 cellSize = max(
      vec2(4.0, 6.0),
      vec2(mix(14.0, 8.0, strength), mix(18.0, 12.0, strength)) * textureScale
    );
    vec2 cell = floor(gl_FragCoord.xy / cellSize);
    vec2 local = fract(gl_FragCoord.xy / cellSize);
    vec2 cellUv = clamp((cell + vec2(0.5)) * cellSize / uResolution, vec2(0.0), vec2(1.0));
    vec3 sampled = sampleBase(cellUv).rgb;
    float lum = luminance(sampled);
    float jitter = (random(cell + vec2(17.0, 53.0)) - 0.5) * 0.14;
    float glyph = floor(clamp(lum + jitter, 0.0, 0.999) * 8.0);
    float mask = asciiGlyph(glyph, local);
    vec3 softened = mix(color, sampled * mix(0.84, 0.64, strength), strength * 0.42);
    vec3 ink = clamp(mix(sampled, vec3(1.0), 0.28 + strength * 0.48), 0.0, 1.0);
    float alpha = mask * (0.34 + strength * 0.54) * (0.34 + lum * 0.76);

    return mix(softened, ink, alpha);
  }
`
