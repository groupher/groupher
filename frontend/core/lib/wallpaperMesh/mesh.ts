import { CANVAS_HEIGHT, CANVAS_WIDTH, DEFAULT_MESH_COLORS } from './constant'
import { clamp, getFlowEndpoints } from './helper'
import type { TMeshGradientRecipe } from './spec'

/**
 * Normalize a persisted mesh recipe before rendering or previewing it.
 *
 * @example
 * normalizeMeshRecipe(recipe).flow // clamped to 0..359
 */
export const normalizeMeshRecipe = (recipe: TMeshGradientRecipe): TMeshGradientRecipe => ({
  ...recipe,
  version: 1,
  kind: 'mesh',
  seed: Number.isFinite(recipe.seed) ? recipe.seed : 1,
  colors: recipe.colors.length ? recipe.colors : [...DEFAULT_MESH_COLORS],
  flow: clamp(recipe.flow, 0, 359),
  softness: clamp(recipe.softness, 0, 100),
  contrast: clamp(recipe.contrast, 60, 140),
  brightness: clamp(recipe.brightness, 60, 140),
  anchors: recipe.anchors.length
    ? recipe.anchors.map((anchor) => ({
        x: clamp(anchor.x, 0, 1),
        y: clamp(anchor.y, 0, 1),
        color: clamp(anchor.color, 0, Math.max(recipe.colors.length - 1, 0)),
      }))
    : [{ x: 0.5, y: 0.5, color: 0 }],
})

/**
 * Build the CSS fallback for a mesh wallpaper when WebGL is unavailable.
 *
 * @example
 * const background = buildMeshGradientFallback(recipe)
 */
export const buildMeshGradientFallback = (recipe: TMeshGradientRecipe): string => {
  const safeRecipe = normalizeMeshRecipe(recipe)
  const layers = safeRecipe.anchors.map((anchor) => {
    const color = safeRecipe.colors[anchor.color] || safeRecipe.colors[0] || DEFAULT_MESH_COLORS[0]
    const radius = Math.round(18 + safeRecipe.softness * 0.52)

    return `radial-gradient(circle at ${Math.round(anchor.x * 100)}% ${Math.round(anchor.y * 100)}%, ${color} 0%, color-mix(in srgb, ${color} 45%, transparent) ${Math.round(radius * 0.45)}%, transparent ${radius}%)`
  })
  const linear = `linear-gradient(${safeRecipe.flow}deg, ${safeRecipe.colors.join(',')})`

  return [...layers, linear].join(',')
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

  for (const anchor of safeRecipe.anchors) {
    const color = safeRecipe.colors[anchor.color] || safeRecipe.colors[0] || DEFAULT_MESH_COLORS[0]
    const radius = width * (0.16 + safeRecipe.softness * 0.0038)
    const hardStop = clamp(0.04 + safeRecipe.softness / 280, 0.04, 0.34)
    const alpha = clamp(0.72 - safeRecipe.softness / 220, 0.26, 0.72)
    const x = anchor.x * width
    const y = anchor.y * height
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)

    gradient.addColorStop(0, color)
    gradient.addColorStop(hardStop, color)
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')

    ctx.globalAlpha = alpha
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
  }

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
