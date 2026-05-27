import { clamp, seededRandom } from '../helper'
import type { TTextureSurface } from '../spec'

export const GRAIN_WEBGL_ID = 1

export const GRAIN_SHADER_BRANCH = `
  if (uTextureType == ${GRAIN_WEBGL_ID}) {
    vec2 pixel = gl_FragCoord.xy;
    vec2 densityGrid = pixel / 92.0;
    vec2 densityCell = floor(densityGrid);
    vec2 densityBlend = fract(densityGrid);
    densityBlend = densityBlend * densityBlend * (3.0 - 2.0 * densityBlend);

    float d00 = random(densityCell + vec2(7.0, 19.0));
    float d10 = random(densityCell + vec2(8.0, 19.0));
    float d01 = random(densityCell + vec2(7.0, 20.0));
    float d11 = random(densityCell + vec2(8.0, 20.0));
    float localDensity = mix(mix(d00, d10, densityBlend.x), mix(d01, d11, densityBlend.x), densityBlend.y);

    float density = clamp((0.025 + strength * strength * 0.68) * mix(0.78, 1.22, localDensity), 0.0, 0.9);
    float cellSize = 2.65;
    vec2 grainGrid = pixel / cellSize;
    vec2 grainCell = floor(grainGrid);
    vec2 cellPosition = fract(grainGrid);
    float grain = 0.0;

    for (int y = -1; y <= 1; y += 1) {
      for (int x = -1; x <= 1; x += 1) {
        vec2 offset = vec2(float(x), float(y));
        vec2 cell = grainCell + offset;
        float dotSeed = random(cell + vec2(37.0, 91.0));
        float dotMask = step(1.0 - density, dotSeed);
        vec2 center = vec2(
          random(cell + vec2(113.0, 17.0)),
          random(cell + vec2(29.0, 173.0))
        );
        float sizeSeed = random(cell + vec2(211.0, 43.0));
        float largeDot = step(0.86, sizeSeed);
        float radius = mix(0.22 + sizeSeed * 0.15, 0.48 + sizeSeed * 0.12, largeDot);
        float dist = length(cellPosition - (offset + center));
        float shape = 1.0 - smoothstep(radius, radius + 0.16, dist);
        float toneSeed = random(cell + vec2(103.0, 17.0));
        float alphaSeed = random(cell + vec2(11.0, 211.0));
        float lightAmount = mix(0.055, 0.088, alphaSeed);
        float darkAmount = mix(0.012, 0.024, alphaSeed);
        float isLight = step(0.12, toneSeed);
        float dotTone = mix(-darkAmount, lightAmount, isLight);

        grain += dotMask * shape * dotTone;
      }
    }

    return clamp(color + grain, 0.0, 1.0);
  }
`

const getGrainDensity = (amount: number, surface: TTextureSurface): number => {
  const baseDensity = surface === 'wallpaper' ? 0.012 : surface === 'preview' ? 0.014 : 0.018
  const densityRange = surface === 'wallpaper' ? 0.2 : surface === 'preview' ? 0.18 : 0.15

  return baseDensity + amount * amount * densityRange
}

const getGrainDotSize = (
  random: () => number,
  amount: number,
  surface: TTextureSurface,
): [number, number] => {
  const sizeSeed = random()
  const largeThreshold = surface === 'wallpaper' ? 0.985 : 0.995
  const stretchedThreshold = surface === 'wallpaper' ? 0.86 - amount * 0.04 : 0.92

  if (sizeSeed > largeThreshold) return [2, 2]
  if (sizeSeed > stretchedThreshold) return random() > 0.5 ? [2, 1] : [1, 2]

  return [1, 1]
}

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
  const amount = clamp(intensity, 0, 100) / 100
  const density = getGrainDensity(amount, surface)
  const tileSize = surface === 'wallpaper' ? 92 : 64
  const lightAlpha = (surface === 'wallpaper' ? 0.06 : 0.074) + amount * 0.012
  const darkAlpha = (surface === 'wallpaper' ? 0.012 : 0.016) + amount * 0.004

  ctx.save()
  for (let tileY = 0; tileY < height; tileY += tileSize) {
    const tileHeight = Math.min(tileSize, height - tileY)

    for (let tileX = 0; tileX < width; tileX += tileSize) {
      const tileWidth = Math.min(tileSize, width - tileX)
      const localDensity = density * (0.78 + random() * 0.44)
      const count = Math.round(tileWidth * tileHeight * localDensity)

      for (let i = 0; i < count; i += 1) {
        const x = tileX + Math.floor(random() * tileWidth)
        const y = tileY + Math.floor(random() * tileHeight)
        const isLight = random() > 0.12
        const alpha = (isLight ? lightAlpha : darkAlpha) * (0.5 + random() * 0.5)
        const [dotWidth, dotHeight] = getGrainDotSize(random, amount, surface)

        ctx.fillStyle = isLight ? `rgba(255, 255, 255, ${alpha})` : `rgba(0, 0, 0, ${alpha})`
        ctx.fillRect(x, y, dotWidth, dotHeight)
      }
    }
  }
  ctx.restore()
}
