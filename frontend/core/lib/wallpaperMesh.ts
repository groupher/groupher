export type TMeshGradientAnchor = {
  x: number
  y: number
  color: number
}

export type TImageTextureType = 'grain' | 'pixelate' | 'screentone' | 'dither'

export type TWallpaperTexture = {
  type: TImageTextureType
  strength: number
}

type TTextureSurface = 'wallpaper' | 'preview' | 'swatch'

export type TMeshGradientRecipe = {
  version: 1
  kind: 'mesh'
  preset: string
  seed: number
  colors: string[]
  flow: number
  softness: number
  texture: TWallpaperTexture
  contrast: number
  brightness: number
  anchors: TMeshGradientAnchor[]
}

const FALLBACK_COLOR = '#d8b9e3'
const CANVAS_WIDTH = 960
const CANVAS_HEIGHT = 600
const PREVIEW_WIDTH = 420
const PREVIEW_HEIGHT = 260
const SWATCH_BG = '#f7f3ed'
const SWATCH_DIGEST = '#8b8174'

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

const getLuminance = (r: number, g: number, b: number): number =>
  (r * 0.299 + g * 0.587 + b * 0.114) / 255

const seededRandom = (seed: number) => {
  let value = seed || 1

  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296
    return value / 4294967296
  }
}

const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = url
  })

const drawCoverImage = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
): void => {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
  const sourceWidth = width / scale
  const sourceHeight = height / scale
  const sourceX = (image.naturalWidth - sourceWidth) / 2
  const sourceY = (image.naturalHeight - sourceHeight) / 2

  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height)
}

export const normalizeTextureType = (type?: string): TImageTextureType => {
  if (type === 'mosaic') return 'pixelate'
  if (type === 'dot' || type === 'halftone') return 'screentone'
  if (type === 'pixelate' || type === 'screentone' || type === 'dither') {
    return type
  }

  return 'grain'
}

export const normalizeTexture = (
  value?: Partial<TWallpaperTexture> & { grain?: number },
): TWallpaperTexture => ({
  type: normalizeTextureType(value?.type),
  strength: clamp(value?.strength ?? value?.grain ?? 8, 0, 100),
})

const normalizeRecipe = (recipe: TMeshGradientRecipe): TMeshGradientRecipe => ({
  ...recipe,
  version: 1,
  kind: 'mesh',
  seed: Number.isFinite(recipe.seed) ? recipe.seed : 1,
  colors: recipe.colors.length ? recipe.colors : [FALLBACK_COLOR],
  flow: clamp(recipe.flow, 0, 359),
  softness: clamp(recipe.softness, 0, 100),
  texture: normalizeTexture(
    recipe.texture || { grain: (recipe as TMeshGradientRecipe & { grain?: number }).grain },
  ),
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

const getFlowEndpoints = (flow: number, width = CANVAS_WIDTH, height = CANVAS_HEIGHT) => {
  const rad = ((flow - 90) * Math.PI) / 180
  const x = Math.cos(rad)
  const y = Math.sin(rad)

  return {
    x0: width * (0.5 - x * 0.5),
    y0: height * (0.5 - y * 0.5),
    x1: width * (0.5 + x * 0.5),
    y1: height * (0.5 + y * 0.5),
  }
}

const renderMeshBase = (
  recipe: TMeshGradientRecipe,
  width = CANVAS_WIDTH,
  height = CANVAS_HEIGHT,
): HTMLCanvasElement | null => {
  const safeRecipe = normalizeRecipe(recipe)
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
    const color = safeRecipe.colors[anchor.color] || safeRecipe.colors[0] || FALLBACK_COLOR
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

const renderPixelateTexture = (
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  width: number,
  height: number,
  intensity: number,
  surface: TTextureSurface,
): void => {
  const blockSize =
    surface === 'wallpaper'
      ? Math.round(2 + intensity * 0.045)
      : surface === 'preview'
        ? Math.round(3 + intensity * 0.07)
        : Math.round(3 + intensity * 0.12)
  const sampleWidth = Math.max(1, Math.round(width / blockSize))
  const sampleHeight = Math.max(1, Math.round(height / blockSize))
  const sample = document.createElement('canvas')
  sample.width = sampleWidth
  sample.height = sampleHeight

  const sampleCtx = sample.getContext('2d')
  if (!sampleCtx) return

  sampleCtx.imageSmoothingEnabled = true
  sampleCtx.drawImage(source, 0, 0, sampleWidth, sampleHeight)

  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, width, height)
  ctx.drawImage(sample, 0, 0, sampleWidth, sampleHeight, 0, 0, width, height)

  if (surface !== 'swatch') {
    ctx.globalAlpha = 0.14
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(source, 0, 0, width, height)
    ctx.globalAlpha = 1
  }
  ctx.restore()
}

const renderScreentoneTexture = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number,
  surface: TTextureSurface,
): void => {
  const imageData = ctx.getImageData(0, 0, width, height)
  const step = surface === 'wallpaper' ? 5 : surface === 'preview' ? 6 : 4
  const alpha = (surface === 'wallpaper' ? 0.12 : 0.2) + intensity * 0.0028
  const radius = step * (0.2 + intensity * 0.0018)

  ctx.save()
  ctx.fillStyle = `rgba(118, 110, 100, ${alpha})`
  for (let y = step / 2; y < height; y += step) {
    const offset = Math.floor(y / step) % 2 === 0 ? 0 : step / 2

    for (let x = step / 2 + offset; x < width; x += step) {
      const index = (Math.floor(y) * width + Math.floor(clamp(x, 0, width - 1))) * 4
      const r = imageData.data[index]
      const g = imageData.data[index + 1]
      const b = imageData.data[index + 2]
      const luminance = getLuminance(r, g, b)
      if (luminance > 0.82 && surface === 'wallpaper') continue

      ctx.globalAlpha = alpha * (0.35 + (1 - luminance) * 1.2)
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1
  ctx.restore()
}

const renderImageGrainTexture = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number,
  surface: TTextureSurface,
): void => {
  const random = seededRandom(91283)
  const density = surface === 'wallpaper' ? 0.14 : surface === 'preview' ? 0.1 : 0.13
  const count = Math.round(width * height * (density + intensity * 0.00125))
  const lightAlpha = (surface === 'wallpaper' ? 0.045 : 0.06) + intensity * 0.00075
  const darkAlpha = (surface === 'wallpaper' ? 0.012 : 0.018) + intensity * 0.00018

  ctx.save()
  for (let i = 0; i < count; i += 1) {
    const x = Math.floor(random() * width)
    const y = Math.floor(random() * height)
    const isLight = random() > 0.16
    const alpha = (isLight ? lightAlpha : darkAlpha) * (0.35 + random() * 0.65)
    const dotWidth = surface === 'wallpaper' && random() > 0.92 ? 2 : 1

    ctx.fillStyle = isLight ? `rgba(255, 255, 255, ${alpha})` : `rgba(0, 0, 0, ${alpha})`
    ctx.fillRect(x, y, dotWidth, 1)
  }
  ctx.restore()
}

const renderDitherTexture = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number,
  surface: TTextureSurface,
): void => {
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  const matrix = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
  const amount = clamp(intensity / 100, 0, 1)
  const levels = surface === 'wallpaper' ? 7 : 5
  const thresholdPower = surface === 'wallpaper' ? 0.11 : 0.18

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      const threshold = (matrix[(y % 4) * 4 + (x % 4)] / 15 - 0.5) * thresholdPower * amount

      for (let channel = 0; channel < 3; channel += 1) {
        const original = data[index + channel]
        const normalized = clamp(original / 255 + threshold, 0, 1)
        const quantized = Math.round(normalized * (levels - 1)) / (levels - 1)
        data[index + channel] = Math.round(
          original * (1 - amount * 0.76) + quantized * 255 * amount * 0.76,
        )
      }
    }
  }

  ctx.putImageData(imageData, 0, 0)
}

const renderTexture = (
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  width: number,
  height: number,
  texture: TWallpaperTexture,
  surface: TTextureSurface,
): void => {
  const strength = clamp(texture.strength, 0, 100)
  if (strength <= 0) return

  if (texture.type === 'grain') {
    renderImageGrainTexture(ctx, width, height, strength, surface)
  }

  if (texture.type === 'pixelate') {
    renderPixelateTexture(ctx, source, width, height, strength, surface)
  }

  if (texture.type === 'screentone') {
    renderScreentoneTexture(ctx, width, height, strength, surface)
  }

  if (texture.type === 'dither') {
    renderDitherTexture(ctx, width, height, strength, surface)
  }
}

export const renderImageTextureDataUrl = async ({
  imageUrl,
  texture,
  intensity = 55,
  width = 360,
  height = 170,
  surface = 'preview',
}: {
  imageUrl: string
  texture: TImageTextureType
  intensity?: number
  width?: number
  height?: number
  surface?: TTextureSurface
}): Promise<string | null> => {
  if (typeof document === 'undefined') return null

  const safeIntensity = clamp(intensity, 0, 100)
  const image = await loadImage(imageUrl)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  drawCoverImage(ctx, image, width, height)

  const source = document.createElement('canvas')
  source.width = width
  source.height = height

  const sourceCtx = source.getContext('2d')
  if (!sourceCtx) return null

  drawCoverImage(sourceCtx, image, width, height)
  renderTexture(ctx, source, width, height, { type: texture, strength: safeIntensity }, surface)

  return canvas.toDataURL('image/png')
}

const parseGradientAngle = (direction = '180deg'): number => {
  const direction$ = direction.trim().toLowerCase()
  const legacy: Record<string, number> = {
    top: 0,
    'top right': 45,
    right: 90,
    'bottom right': 135,
    bottom: 180,
    'bottom left': 225,
    left: 270,
    'top left': 315,
  }

  if (direction$ in legacy) return legacy[direction$]

  const match = direction$.match(/^(-?\d+(?:\.\d+)?)deg$/)
  if (!match) return 180

  return Math.round(((Number(match[1]) % 360) + 360) % 360)
}

export const renderGradientTextureDataUrl = async ({
  colors,
  direction = '180deg',
  hasPattern = false,
  texture,
  intensity = 45,
  width = 1920,
  height = 1080,
  surface = 'wallpaper',
}: {
  colors: string[]
  direction?: string
  hasPattern?: boolean
  texture: TImageTextureType
  intensity?: number
  width?: number
  height?: number
  surface?: TTextureSurface
}): Promise<string | null> => {
  if (typeof document === 'undefined') return null

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const flow = getFlowEndpoints(parseGradientAngle(direction), width, height)
  const gradient = ctx.createLinearGradient(flow.x0, flow.y0, flow.x1, flow.y1)
  const safeColors = colors.length ? colors : [FALLBACK_COLOR]
  const colorCount = Math.max(safeColors.length - 1, 1)

  for (let index = 0; index < safeColors.length; index += 1) {
    gradient.addColorStop(index / colorCount, safeColors[index])
  }

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  if (hasPattern) {
    try {
      const patternImage = await loadImage('/wallpaper/pattern/1.png')
      const pattern = ctx.createPattern(patternImage, 'repeat')
      if (pattern) {
        ctx.fillStyle = pattern
        ctx.globalAlpha = 0.55
        ctx.fillRect(0, 0, width, height)
        ctx.globalAlpha = 1
      }
    } catch {
      // Pattern is decorative; keep the textured gradient if the asset is unavailable.
    }
  }

  const source = document.createElement('canvas')
  source.width = width
  source.height = height

  const sourceCtx = source.getContext('2d')
  if (!sourceCtx) return null

  sourceCtx.drawImage(canvas, 0, 0)
  renderTexture(ctx, source, width, height, { type: texture, strength: intensity }, surface)

  return canvas.toDataURL('image/png')
}

export const renderMeshGradientDataUrl = (recipe: TMeshGradientRecipe): string | null => {
  if (typeof document === 'undefined') return null

  const safeRecipe = normalizeRecipe(recipe)
  const canvas = renderMeshBase(safeRecipe)
  if (!canvas) return null

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  renderTexture(ctx, canvas, CANVAS_WIDTH, CANVAS_HEIGHT, safeRecipe.texture, 'wallpaper')

  return `url(${canvas.toDataURL('image/png')}) center / cover no-repeat`
}

export const renderMeshTexturePreviewDataUrl = ({
  recipe,
  texture,
  width = PREVIEW_WIDTH,
  height = PREVIEW_HEIGHT,
}: {
  recipe: TMeshGradientRecipe
  texture: TWallpaperTexture
  width?: number
  height?: number
}): string | null => {
  if (typeof document === 'undefined') return null

  const safeRecipe = normalizeRecipe({ ...recipe, texture })
  const canvas = renderMeshBase(safeRecipe, width, height)
  if (!canvas) return null

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  renderTexture(ctx, canvas, width, height, texture, 'preview')

  return canvas.toDataURL('image/png')
}

export const renderTextureSwatchDataUrl = ({
  texture,
  width = 80,
  height = 80,
}: {
  texture: TWallpaperTexture
  width?: number
  height?: number
}): string | null => {
  if (typeof document === 'undefined') return null

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = SWATCH_BG
  ctx.fillRect(0, 0, width, height)

  const source = document.createElement('canvas')
  source.width = width
  source.height = height
  const sourceCtx = source.getContext('2d')
  if (!sourceCtx) return null

  const gradient = sourceCtx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, SWATCH_BG)
  gradient.addColorStop(0.52, '#efe9e1')
  gradient.addColorStop(1, '#dfd6cb')
  sourceCtx.fillStyle = gradient
  sourceCtx.fillRect(0, 0, width, height)
  ctx.drawImage(source, 0, 0)

  renderTexture(ctx, source, width, height, texture, 'swatch')

  if (texture.type === 'grain') {
    ctx.fillStyle = SWATCH_DIGEST
    ctx.globalAlpha = 0.22 + texture.strength * 0.004
    const random = seededRandom(28711)
    for (let i = 0; i < 160; i += 1) {
      ctx.fillRect(Math.floor(random() * width), Math.floor(random() * height), 1, 1)
    }
    ctx.globalAlpha = 1
  }

  return canvas.toDataURL('image/png')
}
