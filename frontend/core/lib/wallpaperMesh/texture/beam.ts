import { WALLPAPER_TEXTURE_SURFACE } from '../constant'
import { clamp, seededRandom } from '../helper'
import type { TTextureSurface } from '../spec'

export const BEAM_WEBGL_ID = 5

type TBeamColumn = {
  x: number
  width: number
  variance: number
  ridge: number
}

const getBeamWidthAmount = (intensity: number): number => {
  const amount = clamp(intensity / 100, 0, 1)

  return Math.pow(amount, 0.72)
}

const getGlassAmount = (intensity: number): number => {
  const amount = clamp(intensity / 100, 0, 1)

  return clamp(0.58 + Math.pow(amount, 0.48) * 0.42, 0, 1)
}

const getBeamWidth = (intensity: number, surface: TTextureSurface): number => {
  const amount = getBeamWidthAmount(intensity)
  const min =
    surface === WALLPAPER_TEXTURE_SURFACE.WALLPAPER
      ? 13
      : surface === WALLPAPER_TEXTURE_SURFACE.PREVIEW
        ? 8
        : 6
  const max =
    surface === WALLPAPER_TEXTURE_SURFACE.WALLPAPER
      ? 54
      : surface === WALLPAPER_TEXTURE_SURFACE.PREVIEW
        ? 28
        : 18

  return Math.round(max - (max - min) * amount)
}

const createBeamColumns = (width: number, beamWidth: number): Array<TBeamColumn> => {
  const random = seededRandom(42137)
  const columns: Array<TBeamColumn> = []

  let x = 0
  while (x < width) {
    const variance = random()
    const columnWidth = Math.min(width - x, Math.max(4, beamWidth * (0.92 + variance * 0.16)))

    columns.push({
      x,
      width: columnWidth,
      variance,
      ridge: 0.6 + random() * 0.26,
    })

    x += columnWidth
  }

  return columns
}

const createSmearedSource = (
  source: HTMLCanvasElement,
  width: number,
  height: number,
  amount: number,
): HTMLCanvasElement => {
  const doc = source.ownerDocument
  const lowWidth = Math.max(4, Math.round(width * (0.14 - amount * 0.06)))
  const lowHeight = Math.max(4, Math.round(height * (0.22 - amount * 0.08)))
  const low = doc.createElement('canvas')
  const smeared = doc.createElement('canvas')

  low.width = lowWidth
  low.height = lowHeight
  smeared.width = width
  smeared.height = height

  const lowCtx = low.getContext('2d')
  const smearedCtx = smeared.getContext('2d')
  if (!lowCtx || !smearedCtx) return source

  lowCtx.imageSmoothingEnabled = true
  lowCtx.drawImage(source, 0, 0, lowWidth, lowHeight)

  smearedCtx.imageSmoothingEnabled = true
  smearedCtx.filter = `blur(${4 + amount * 7}px) saturate(${112 + amount * 20}%) brightness(${104 + amount * 6}%)`
  smearedCtx.drawImage(low, -width * 0.04, -height * 0.03, width * 1.08, height * 1.06)

  return smeared
}

const drawGlassField = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  source: HTMLCanvasElement,
  columns: Array<TBeamColumn>,
  amount: number,
): void => {
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.globalAlpha = 0.72 + amount * 0.24
  ctx.filter = `saturate(${118 + amount * 16}%) contrast(${92 + amount * 6}%) brightness(${106 + amount * 6}%) blur(${4 + amount * 5}px)`

  for (const column of columns) {
    const sampleWidth = Math.max(2, column.width * (0.08 + amount * 0.11))
    const center = column.x + column.width * (0.5 + (column.variance - 0.5) * 0.18)
    const sourceX = clamp(center - sampleWidth / 2, 0, Math.max(0, width - sampleWidth))
    const overlap = Math.max(2, column.width * (0.22 + amount * 0.06))

    ctx.drawImage(
      source,
      sourceX,
      0,
      sampleWidth,
      height,
      column.x - overlap,
      0,
      column.width + overlap * 2,
      height,
    )
  }

  ctx.restore()
}

const fillFineRidges = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number,
  surface: TTextureSurface,
): void => {
  const ridgeWidth =
    surface === WALLPAPER_TEXTURE_SURFACE.WALLPAPER
      ? 8
      : surface === WALLPAPER_TEXTURE_SURFACE.PREVIEW
        ? 5
        : 4
  const highlightAlpha = 0.018 + amount * 0.042
  const shadowAlpha = 0.012 + amount * 0.024

  ctx.save()
  ctx.globalCompositeOperation = 'source-over'
  for (let x = 0; x < width; x += ridgeWidth) {
    ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`
    ctx.fillRect(x, 0, Math.max(1, ridgeWidth * 0.18), height)

    ctx.fillStyle = `rgba(255, 255, 255, ${highlightAlpha})`
    ctx.fillRect(x + ridgeWidth * 0.62, 0, Math.max(1, ridgeWidth * 0.16), height)
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
  ridge: number,
): void => {
  const edgeAlpha = 0.035 + amount * 0.072 + variance * 0.01
  const highlightAlpha = 0.048 + amount * 0.12 + variance * 0.018
  const tintAlpha = 0.02 + amount * 0.052
  const ridgeX = x + columnWidth * ridge
  const innerRidgeX = x + columnWidth * (0.28 + variance * 0.12)
  const column = ctx.createLinearGradient(x, 0, x + columnWidth, 0)

  column.addColorStop(0, `rgba(0, 0, 0, ${edgeAlpha})`)
  column.addColorStop(0.1, `rgba(0, 0, 0, ${edgeAlpha * 0.26})`)
  column.addColorStop(0.26, `rgba(255, 255, 255, ${tintAlpha * 0.72})`)
  column.addColorStop(0.48, `rgba(255, 255, 255, ${tintAlpha})`)
  column.addColorStop(0.68, `rgba(255, 255, 255, ${highlightAlpha * 0.18})`)
  column.addColorStop(0.86, `rgba(255, 255, 255, ${highlightAlpha})`)
  column.addColorStop(1, `rgba(0, 0, 0, ${edgeAlpha * 0.52})`)

  ctx.fillStyle = column
  ctx.fillRect(x, 0, columnWidth, height)

  ctx.fillStyle = `rgba(255, 255, 255, ${highlightAlpha * 0.62})`
  ctx.fillRect(ridgeX, 0, Math.max(1, columnWidth * 0.026), height)

  if (columnWidth > 18) {
    ctx.fillStyle = `rgba(255, 255, 255, ${highlightAlpha * 0.18})`
    ctx.fillRect(innerRidgeX, 0, Math.max(1, columnWidth * 0.018), height)
  }

  ctx.fillStyle = `rgba(0, 0, 0, ${edgeAlpha * 0.62})`
  ctx.fillRect(x, 0, Math.max(1, columnWidth * 0.04), height)
}

/**
 * Render vertical blurred glass beams.
 *
 * @example
 * renderBeamTexture(ctx, sourceCanvas, 420, 260, 55, WALLPAPER_TEXTURE_SURFACE.PREVIEW)
 */
export const renderBeamTexture = (
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  width: number,
  height: number,
  intensity: number,
  surface: TTextureSurface,
): void => {
  const amount = getGlassAmount(intensity)
  const beamWidth = getBeamWidth(intensity, surface)
  const columns = createBeamColumns(width, beamWidth)
  const smearedSource = createSmearedSource(source, width, height, amount)

  drawGlassField(ctx, width, height, smearedSource, columns, amount)
  fillFineRidges(ctx, width, height, amount, surface)

  ctx.save()
  ctx.globalCompositeOperation = 'source-over'
  for (const column of columns) {
    fillGlassColumn(ctx, column.x, column.width, height, amount, column.variance, column.ridge)
  }

  ctx.restore()
}

export const BEAM_SHADER_BRANCH = `
  if (uTextureType == ${BEAM_WEBGL_ID}) {
    float widthAmount = pow(max(strength, 0.0), 0.72);
    float amount = strength * strength * (3.0 - 2.0 * strength);
    float glassAmount = clamp(0.46 + amount * 0.54, 0.0, 1.0);
    float beamWidth = max(7.0, mix(54.0, 13.0, widthAmount) * textureScale);
    float grid = gl_FragCoord.x / beamWidth;
    float cell = floor(grid);
    float local = fract(grid);
    float panelWidth = beamWidth / max(uResolution.x, 1.0);
    float centerUv = clamp((cell + 0.5) * panelWidth, 0.0, 1.0);
    float variance = random(vec2(cell, 71.0));
    float center = local * 2.0 - 1.0;
    float edge = pow(abs(center), 1.5);
    float prism = center * (0.34 + edge * 0.82);
    float wobble = (variance - 0.5) * panelWidth * 0.14;
    float curve = prism * panelWidth * (0.68 + glassAmount * 0.62);
    float refractX = clamp(centerUv + wobble + curve, 0.0, 1.0);
    float blurX = panelWidth * (1.05 + glassAmount * 1.18) + (4.0 + glassAmount * 10.0) / max(uResolution.x, 1.0);
    float verticalDrift = (
      sin(uv.y * 5.2 + variance * 6.28318) * 0.5 +
      sin(uv.y * 13.0 + cell * 0.19) * 0.25
    ) * (0.008 + glassAmount * 0.018);
    float sampleY = clamp(uv.y + verticalDrift, 0.0, 1.0);
    float smearY = 0.012 + glassAmount * 0.036;
    vec3 field = vec3(0.0);

    field += sampleBase(vec2(clamp(refractX - blurX * 1.35, 0.0, 1.0), clamp(sampleY - smearY, 0.0, 1.0))).rgb * 0.12;
    field += sampleBase(vec2(clamp(refractX - blurX * 0.62, 0.0, 1.0), clamp(sampleY - smearY * 0.42, 0.0, 1.0))).rgb * 0.2;
    field += sampleBase(vec2(refractX, sampleY)).rgb * 0.36;
    field += sampleBase(vec2(clamp(refractX + blurX * 0.62, 0.0, 1.0), clamp(sampleY + smearY * 0.42, 0.0, 1.0))).rgb * 0.2;
    field += sampleBase(vec2(clamp(refractX + blurX * 1.35, 0.0, 1.0), clamp(sampleY + smearY, 0.0, 1.0))).rgb * 0.12;

    float fieldLum = luminance(field);
    vec3 frosted = mix(field, vec3(fieldLum), 0.04 + glassAmount * 0.08);
    frosted = mix(frosted, vec3(1.0), 0.025 + glassAmount * 0.055);
    vec3 glass = mix(color, frosted, 0.56 + glassAmount * 0.38);
    float leftShadow = 1.0 - smoothstep(0.0, 0.13, local);
    float rightShadow = smoothstep(0.92, 1.0, local);
    float rightHighlight = smoothstep(0.52, 0.8, local) * (1.0 - smoothstep(0.8, 0.98, local));
    float ridgePosition = mix(0.6, 0.86, random(vec2(cell, 137.0)));
    float softRidge = 1.0 - smoothstep(0.0, 0.075, abs(local - ridgePosition));
    float hairline = 1.0 - smoothstep(0.0, 0.018, abs(local - ridgePosition));
    float innerGlow = smoothstep(0.08, 0.38, local) * (1.0 - smoothstep(0.5, 0.92, local));
    float microLocal = fract(gl_FragCoord.x / max(5.5, 7.5 * textureScale));
    float microShadow = 1.0 - smoothstep(0.0, 0.18, microLocal);
    float microRidge = 1.0 - smoothstep(0.0, 0.12, abs(microLocal - 0.68));
    float slowShade = sin(uv.x * 15.0 + uv.y * 3.5 + variance * 2.4) * 0.5 + 0.5;
    float panelShade = (mix(-0.024, 0.022, variance) + mix(-0.014, 0.016, slowShade)) * (0.45 + glassAmount * 0.55);

    glass += vec3(panelShade);
    glass += vec3(1.0) * rightHighlight * (0.024 + glassAmount * 0.056);
    glass += vec3(1.0) * softRidge * (0.016 + glassAmount * 0.036);
    glass += vec3(1.0) * hairline * (0.022 + glassAmount * 0.062);
    glass += vec3(1.0) * innerGlow * (0.012 + glassAmount * 0.026);
    glass += vec3(1.0) * microRidge * (0.01 + glassAmount * 0.024);
    glass -= vec3(1.0) * leftShadow * (0.026 + glassAmount * 0.054);
    glass -= vec3(1.0) * rightShadow * (0.01 + glassAmount * 0.026);
    glass -= vec3(1.0) * microShadow * (0.008 + glassAmount * 0.016);

    return clamp(glass, 0.0, 1.0);
  }
`
