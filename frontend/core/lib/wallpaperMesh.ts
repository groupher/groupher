export type TMeshGradientAnchor = {
  x: number
  y: number
  color: number
}

export type TMeshGradientRecipe = {
  version: 1
  kind: 'mesh'
  preset: string
  seed: number
  colors: string[]
  flow: number
  softness: number
  grain: number
  contrast: number
  brightness: number
  anchors: TMeshGradientAnchor[]
}

const FALLBACK_COLOR = '#d8b9e3'
const CANVAS_WIDTH = 420
const CANVAS_HEIGHT = 260
const GRAIN_TILE_SIZE = 180
const MAX_GRAIN_DENSITY = 0.16
const LIGHT_GRAIN_ALPHA = 0.14
const DARK_GRAIN_ALPHA = 0.04

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

const seededRandom = (seed: number) => {
  let value = seed || 1

  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296
    return value / 4294967296
  }
}

const normalizeRecipe = (recipe: TMeshGradientRecipe): TMeshGradientRecipe => ({
  ...recipe,
  version: 1,
  kind: 'mesh',
  seed: Number.isFinite(recipe.seed) ? recipe.seed : 1,
  colors: recipe.colors.length ? recipe.colors : [FALLBACK_COLOR],
  flow: clamp(recipe.flow, 0, 359),
  softness: clamp(recipe.softness, 0, 100),
  grain: clamp(recipe.grain, 0, 100),
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

export const isMeshGradientValue = (value?: string | null): boolean => {
  if (!value) return false

  try {
    const parsed = JSON.parse(value)
    return parsed?.kind === 'mesh'
  } catch {
    return false
  }
}

export const parseMeshGradientValue = (value?: string | null): TMeshGradientRecipe | null => {
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as TMeshGradientRecipe
    if (parsed?.kind !== 'mesh') return null

    return normalizeRecipe(parsed)
  } catch {
    return null
  }
}

export const stringifyMeshGradientRecipe = (recipe: TMeshGradientRecipe): string =>
  JSON.stringify(normalizeRecipe(recipe))

export const buildMeshGradientFallback = (recipe: TMeshGradientRecipe): string => {
  const safeRecipe = normalizeRecipe(recipe)
  const layers = safeRecipe.anchors.map((anchor) => {
    const color = safeRecipe.colors[anchor.color] || safeRecipe.colors[0] || FALLBACK_COLOR
    const radius = Math.round(18 + safeRecipe.softness * 0.52)

    return `radial-gradient(circle at ${Math.round(anchor.x * 100)}% ${Math.round(anchor.y * 100)}%, ${color} 0%, color-mix(in srgb, ${color} 45%, transparent) ${Math.round(radius * 0.45)}%, transparent ${radius}%)`
  })
  const linear = `linear-gradient(${safeRecipe.flow}deg, ${safeRecipe.colors.join(',')})`

  return [...layers, linear].join(',')
}

const getFlowEndpoints = (flow: number) => {
  const rad = ((flow - 90) * Math.PI) / 180
  const x = Math.cos(rad)
  const y = Math.sin(rad)

  return {
    x0: CANVAS_WIDTH * (0.5 - x * 0.5),
    y0: CANVAS_HEIGHT * (0.5 - y * 0.5),
    x1: CANVAS_WIDTH * (0.5 + x * 0.5),
    y1: CANVAS_HEIGHT * (0.5 + y * 0.5),
  }
}

const renderGrainDataUrl = (recipe: TMeshGradientRecipe): string | null => {
  if (typeof document === 'undefined' || recipe.grain <= 0) return null

  const canvas = document.createElement('canvas')
  canvas.width = GRAIN_TILE_SIZE
  canvas.height = GRAIN_TILE_SIZE

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const random = seededRandom(recipe.seed + 7919)
  const grainCount = Math.round(
    GRAIN_TILE_SIZE * GRAIN_TILE_SIZE * MAX_GRAIN_DENSITY * (recipe.grain / 100),
  )

  ctx.clearRect(0, 0, GRAIN_TILE_SIZE, GRAIN_TILE_SIZE)

  for (let i = 0; i < grainCount; i += 1) {
    const x = Math.floor(random() * GRAIN_TILE_SIZE)
    const y = Math.floor(random() * GRAIN_TILE_SIZE)
    const isLight = random() > 0.1
    const alpha = (isLight ? LIGHT_GRAIN_ALPHA : DARK_GRAIN_ALPHA) * (0.4 + random() * 0.6)

    ctx.fillStyle = isLight ? `rgba(255, 255, 255, ${alpha})` : `rgba(0, 0, 0, ${alpha})`
    ctx.fillRect(x, y, 1, 1)
  }

  return canvas.toDataURL('image/png')
}

export const renderMeshGradientDataUrl = (recipe: TMeshGradientRecipe): string | null => {
  if (typeof document === 'undefined') return null

  const safeRecipe = normalizeRecipe(recipe)
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_WIDTH
  canvas.height = CANVAS_HEIGHT

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.filter = `contrast(${safeRecipe.contrast}%) brightness(${safeRecipe.brightness}%)`

  const flow = getFlowEndpoints(safeRecipe.flow)
  const baseGradient = ctx.createLinearGradient(flow.x0, flow.y0, flow.x1, flow.y1)
  const colorCount = Math.max(safeRecipe.colors.length - 1, 1)
  for (let index = 0; index < safeRecipe.colors.length; index += 1) {
    const color = safeRecipe.colors[index]
    baseGradient.addColorStop(index / colorCount, color)
  }

  ctx.fillStyle = baseGradient
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  for (const anchor of safeRecipe.anchors) {
    const color = safeRecipe.colors[anchor.color] || safeRecipe.colors[0] || FALLBACK_COLOR
    const radius = CANVAS_WIDTH * (0.16 + safeRecipe.softness * 0.0038)
    const hardStop = clamp(0.04 + safeRecipe.softness / 280, 0.04, 0.34)
    const alpha = clamp(0.72 - safeRecipe.softness / 220, 0.26, 0.72)
    const x = anchor.x * CANVAS_WIDTH
    const y = anchor.y * CANVAS_HEIGHT
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)

    gradient.addColorStop(0, color)
    gradient.addColorStop(hardStop, color)
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')

    ctx.globalAlpha = alpha
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  }

  ctx.globalAlpha = 1
  ctx.filter = 'none'

  const meshDataUrl = canvas.toDataURL('image/png')
  const grainDataUrl = renderGrainDataUrl(safeRecipe)

  if (!grainDataUrl) return `url(${meshDataUrl}) center / cover no-repeat`

  return `url(${grainDataUrl}) repeat 0 0 / ${GRAIN_TILE_SIZE}px ${GRAIN_TILE_SIZE}px, url(${meshDataUrl}) no-repeat center / cover`
}
