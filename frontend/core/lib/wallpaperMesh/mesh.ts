import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DEFAULT_MESH_COLORS,
  GRADIENT_TYPE,
  MESH_GRADIENT_MODEL,
} from './constant'
import { clamp, getFlowEndpoints } from './helper'
import type { TGradientRecipe, TMeshGradientModel, TMeshGradientRecipe } from './spec'

const MESH_GRADIENT_MODELS = Object.values(MESH_GRADIENT_MODEL)

const isMeshGradientModel = (model: string): model is TMeshGradientModel =>
  MESH_GRADIENT_MODELS.includes(model as TMeshGradientModel)

const clampFinite = (value: number, fallback: number, min: number, max: number): number =>
  clamp(Number.isFinite(value) ? value : fallback, min, max)

/**
 * Normalize a persisted mesh recipe before rendering or previewing it.
 *
 * @example
 * normalizeMeshRecipe(recipe).flow // clamped to 0..359
 */
export const normalizeMeshRecipe = (recipe: TMeshGradientRecipe): TMeshGradientRecipe => ({
  ...recipe,
  version: 2,
  kind: GRADIENT_TYPE.MESH,
  model: isMeshGradientModel(recipe.model) ? recipe.model : MESH_GRADIENT_MODEL.HAZE,
  seed: Number.isFinite(recipe.seed) ? recipe.seed : 1,
  colors: recipe.colors?.length ? recipe.colors : [...DEFAULT_MESH_COLORS],
  flow: clampFinite(recipe.flow, 180, 0, 359),
  softness: clampFinite(recipe.softness, 72, 0, 100),
  warp: clampFinite(recipe.warp, 55, 0, 100),
  scale: clampFinite(recipe.scale, 55, 0, 100),
  contrast: clampFinite(recipe.contrast, 100, 60, 140),
  brightness: clampFinite(recipe.brightness, 100, 60, 140),
})

export const normalizeEvenGradientStops = (colorCount: number): number[] => {
  if (colorCount <= 1) return [0]

  const maxIndex = colorCount - 1

  return Array.from({ length: colorCount }, (_, index) => Math.round((index / maxIndex) * 100))
}

const normalizeExplicitStops = (colorCount: number, stops?: number[]): number[] | null =>
  stops?.length === colorCount ? stops.map((stop) => clamp(stop, 0, 100)) : null

/**
 * Spread is one user-facing control, but each gradient kind maps it to a
 * different render shape. Linear gradients compress or expand the transition
 * band around the center line, while radial gradients control how far the
 * palette travels outward from the focal point.
 */
export const normalizeLinearGradientStops = (
  colorCount: number,
  spread = 100,
  stops?: number[],
): number[] => {
  const explicitStops = normalizeExplicitStops(colorCount, stops)
  if (explicitStops) return explicitStops
  if (colorCount <= 1) return [0]

  const width = 0.08 + (clamp(spread, 0, 100) / 100) * 0.92
  const maxIndex = colorCount - 1

  return Array.from({ length: colorCount }, (_, index) => {
    const t = index / maxIndex
    const adjusted = clamp(0.5 + (t - 0.5) * width, 0, 1)
    return Math.round(adjusted * 100)
  })
}

export const normalizeRadialGradientStops = (
  colorCount: number,
  spread = 100,
  stops?: number[],
): number[] => {
  const explicitStops = normalizeExplicitStops(colorCount, stops)
  if (explicitStops) return explicitStops
  if (colorCount <= 1) return [0]

  const outerReach = 0.18 + (clamp(spread, 0, 100) / 100) * 0.82
  const maxIndex = colorCount - 1

  return Array.from({ length: colorCount }, (_, index) =>
    Math.round((index / maxIndex) * outerReach * 100),
  )
}

export const normalizeGradientStops = (recipe: TGradientRecipe): number[] => {
  if (recipe.kind === GRADIENT_TYPE.LINEAR) {
    return normalizeLinearGradientStops(recipe.colors.length, recipe.spread, recipe.stops)
  }
  if (recipe.kind === GRADIENT_TYPE.RADIAL) {
    return normalizeRadialGradientStops(recipe.colors.length, recipe.spread, recipe.stops)
  }

  return normalizeEvenGradientStops(recipe.colors.length)
}

const formatColorStops = (colors: string[], stops: number[]): string => {
  const safeColors = colors.length ? colors : DEFAULT_MESH_COLORS

  return safeColors.map((color, index) => `${color} ${stops[index] ?? 0}%`).join(',')
}

export const buildLinearGradientBackground = (recipe: TGradientRecipe): string => {
  if (recipe.kind !== GRADIENT_TYPE.LINEAR) return ''

  return `linear-gradient(${recipe.angle}deg, ${formatColorStops(
    recipe.colors,
    normalizeLinearGradientStops(recipe.colors.length, recipe.spread, recipe.stops),
  )})`
}

export const buildRadialGradientBackground = (recipe: TGradientRecipe): string => {
  if (recipe.kind !== GRADIENT_TYPE.RADIAL) return ''

  return `radial-gradient(${recipe.shape} at ${Math.round(recipe.center.x * 100)}% ${Math.round(
    recipe.center.y * 100,
  )}%, ${formatColorStops(
    recipe.colors,
    normalizeRadialGradientStops(recipe.colors.length, recipe.spread, recipe.stops),
  )})`
}

/**
 * Build the CSS fallback for a mesh wallpaper when WebGL is unavailable.
 *
 * @example
 * const background = buildMeshGradientFallback(recipe)
 */
export const buildMeshGradientFallback = (recipe: TMeshGradientRecipe): string => {
  const safeRecipe = normalizeMeshRecipe(recipe)

  return `linear-gradient(${safeRecipe.flow}deg, ${formatColorStops(
    safeRecipe.colors,
    normalizeEvenGradientStops(safeRecipe.colors.length),
  )})`
}

export const buildGradientBackground = (recipe: TGradientRecipe): string => {
  if (recipe.kind === GRADIENT_TYPE.LINEAR) return buildLinearGradientBackground(recipe)
  if (recipe.kind === GRADIENT_TYPE.RADIAL) return buildRadialGradientBackground(recipe)

  return buildMeshGradientFallback(recipe)
}

/**
 * Render a mesh recipe into a canvas for static previews and dataURL fallback.
 *
 * @example
 * const canvas = renderMeshBase(recipe, 420, 260)
 */
export const renderMeshBase = (
  recipe: TMeshGradientRecipe,
  width = CANVAS_WIDTH,
  height = CANVAS_HEIGHT,
): HTMLCanvasElement | null => {
  const safeRecipe = normalizeMeshRecipe(recipe)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.filter = `contrast(${safeRecipe.contrast}%) brightness(${safeRecipe.brightness}%)`

  const flow = getFlowEndpoints(safeRecipe.flow, width, height)
  const baseGradient = ctx.createLinearGradient(flow.x0, flow.y0, flow.x1, flow.y1)
  const colorCount = Math.max(safeRecipe.colors.length - 1, 1)
  for (let index = 0; index < safeRecipe.colors.length; index += 1) {
    const color = safeRecipe.colors[index]
    baseGradient.addColorStop(index / colorCount, color)
  }

  ctx.fillStyle = baseGradient
  ctx.fillRect(0, 0, width, height)

  const glow = ctx.createRadialGradient(
    width * 0.54,
    height * 0.42,
    0,
    width * 0.54,
    height * 0.42,
    width * 0.72,
  )
  glow.addColorStop(0, safeRecipe.colors[1] || safeRecipe.colors[0])
  glow.addColorStop(1, 'rgba(255, 255, 255, 0)')

  ctx.globalAlpha = 0.24 + (safeRecipe.softness / 100) * 0.24
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, width, height)

  ctx.globalAlpha = 1
  ctx.filter = 'none'

  return canvas
}

/**
 * Convert a mesh recipe into a CSS url(...) background dataURL.
 *
 * @example
 * const background = renderMeshGradientDataUrl(recipe)
 */
export const renderMeshGradientDataUrl = (recipe: TMeshGradientRecipe): string | null => {
  if (typeof document === 'undefined') return null

  const safeRecipe = normalizeMeshRecipe(recipe)
  const canvas = renderMeshBase(safeRecipe)
  if (!canvas) return null

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  return `url(${canvas.toDataURL('image/png')}) center / cover no-repeat`
}
