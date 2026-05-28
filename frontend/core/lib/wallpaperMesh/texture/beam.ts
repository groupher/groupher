import { clamp, seededRandom } from '../helper'
import type { TTextureSurface } from '../spec'

export const BEAM_WEBGL_ID = 5

const getBeamAmount = (intensity: number): number => {
  const amount = clamp(intensity / 100, 0, 1)

  return amount * amount * (3 - 2 * amount)
}

const getBeamWidth = (intensity: number, surface: TTextureSurface): number => {
  const amount = getBeamAmount(intensity)
  const min = surface === 'wallpaper' ? 30 : surface === 'preview' ? 16 : 10
  const max = surface === 'wallpaper' ? 52 : surface === 'preview' ? 28 : 18

  return Math.round(max - (max - min) * amount)
}

const drawGlassField = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  source: HTMLCanvasElement,
  beamWidth: number,
  amount: number,
): void => {
  const random = seededRandom(42137)
  const sampleWidth = Math.max(2, beamWidth * (0.26 + amount * 0.18))

  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.globalAlpha = 0.12 + amount * 0.22
  ctx.filter = `saturate(${108 + amount * 14}%) contrast(${94 - amount * 5}%) brightness(${102 + amount * 4}%) blur(${1 + amount * 1.8}px)`

  for (let x = 0; x < width; x += beamWidth) {
    const columnWidth = Math.min(beamWidth, width - x)
    const variance = random()
    const center = x + columnWidth * (0.5 + (variance - 0.5) * 0.16)
    const sourceX = clamp(center - sampleWidth / 2, 0, Math.max(0, width - sampleWidth))
    const overlap = Math.max(2, beamWidth * 0.1)

    ctx.drawImage(
      source,
      sourceX,
      0,
      sampleWidth,
      height,
      x - overlap,
      0,
      columnWidth + overlap * 2,
      height,
    )
  }

  ctx.restore()
}

const fillGlassColumn = (
  ctx: CanvasRenderingContext2D,
  x: number,
  columnWidth: number,
  height: number,
  amount: number,
  variance: number,
): void => {
  const edgeAlpha = 0.02 + amount * 0.055 + variance * 0.012
  const lineAlpha = 0.036 + amount * 0.085 + variance * 0.014
  const tintAlpha = 0.012 + amount * 0.032
  const ridgeX = x + columnWidth * (0.68 + variance * 0.16)
  const column = ctx.createLinearGradient(x, 0, x + columnWidth, 0)

  column.addColorStop(0, `rgba(0, 0, 0, ${edgeAlpha})`)
  column.addColorStop(0.14, `rgba(255, 255, 255, ${tintAlpha * 0.28})`)
  column.addColorStop(0.46, `rgba(255, 255, 255, ${tintAlpha})`)
  column.addColorStop(0.7, `rgba(255, 255, 255, ${lineAlpha * 0.36})`)
  column.addColorStop(0.84, `rgba(255, 255, 255, ${lineAlpha})`)
  column.addColorStop(1, `rgba(0, 0, 0, ${edgeAlpha * 0.34})`)

  ctx.fillStyle = column
  ctx.fillRect(x, 0, columnWidth, height)

  ctx.fillStyle = `rgba(255, 255, 255, ${lineAlpha * 0.7})`
  ctx.fillRect(ridgeX, 0, Math.max(1, columnWidth * 0.035), height)

  ctx.fillStyle = `rgba(0, 0, 0, ${edgeAlpha * 0.62})`
  ctx.fillRect(x, 0, Math.max(1, columnWidth * 0.03), height)
}

/**
 * Render vertical blurred glass beams.
 *
 * @example
 * renderBeamTexture(ctx, sourceCanvas, 420, 260, 55, 'preview')
 */
export const renderBeamTexture = (
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  width: number,
  height: number,
  intensity: number,
  surface: TTextureSurface,
): void => {
  const amount = getBeamAmount(intensity)
  const beamWidth = getBeamWidth(intensity, surface)
  const random = seededRandom(42137)

  drawGlassField(ctx, width, height, source, beamWidth, amount)

  ctx.save()
  ctx.globalCompositeOperation = 'source-over'
  for (let x = 0; x < width; x += beamWidth) {
    fillGlassColumn(ctx, x, beamWidth, height, amount, random())
  }

  ctx.restore()
}

export const BEAM_SHADER_BRANCH = `
  if (uTextureType == ${BEAM_WEBGL_ID}) {
    float amount = strength * strength * (3.0 - 2.0 * strength);
    float beamWidth = mix(52.0, 30.0, amount);
    float grid = gl_FragCoord.x / beamWidth;
    float cell = floor(grid);
    float local = fract(grid);
    float panelWidth = beamWidth / max(uResolution.x, 1.0);
    float centerUv = clamp((cell + 0.5) * panelWidth, 0.0, 1.0);
    float variance = random(vec2(cell, 71.0));
    float wobble = (variance - 0.5) * panelWidth * 0.12;
    float curve = (local - 0.5) * panelWidth * (0.18 + amount * 0.24);
    float refractX = clamp(centerUv + wobble + curve, 0.0, 1.0);
    float blurX = panelWidth * (0.22 + amount * 0.2);
    vec3 field = vec3(0.0);

    field += sampleBase(vec2(clamp(refractX - blurX, 0.0, 1.0), uv.y)).rgb * 0.18;
    field += sampleBase(vec2(clamp(refractX - blurX * 0.45, 0.0, 1.0), uv.y)).rgb * 0.22;
    field += sampleBase(vec2(refractX, uv.y)).rgb * 0.28;
    field += sampleBase(vec2(clamp(refractX + blurX * 0.45, 0.0, 1.0), uv.y)).rgb * 0.22;
    field += sampleBase(vec2(clamp(refractX + blurX, 0.0, 1.0), uv.y)).rgb * 0.18;
    field *= 0.9259259;

    float fieldLum = luminance(field);
    vec3 glass = mix(color, field, 0.14 + amount * 0.24);
    glass = mix(glass, vec3(fieldLum), 0.018 + amount * 0.035);
    float leftShadow = 1.0 - smoothstep(0.0, 0.16, local);
    float rightHighlight = smoothstep(0.52, 0.78, local) * (1.0 - smoothstep(0.78, 0.96, local));
    float ridgePosition = mix(0.68, 0.84, random(vec2(cell, 137.0)));
    float softRidge = 1.0 - smoothstep(0.0, 0.055, abs(local - ridgePosition));
    float hairline = 1.0 - smoothstep(0.0, 0.022, abs(local - ridgePosition));
    float innerGlow = smoothstep(0.12, 0.42, local) * (1.0 - smoothstep(0.5, 0.9, local));
    float slowShade = sin(uv.x * 18.0 + variance * 2.4) * 0.5 + 0.5;
    float panelShade = (mix(-0.018, 0.018, variance) + mix(-0.01, 0.012, slowShade)) * (0.55 + amount * 0.45);

    glass += vec3(panelShade);
    glass += vec3(1.0) * rightHighlight * (0.018 + amount * 0.04);
    glass += vec3(1.0) * softRidge * (0.014 + amount * 0.028);
    glass += vec3(1.0) * hairline * (0.018 + amount * 0.05);
    glass += vec3(1.0) * innerGlow * amount * 0.018;
    glass -= vec3(1.0) * leftShadow * (0.018 + amount * 0.04);

    return clamp(glass, 0.0, 1.0);
  }
`
