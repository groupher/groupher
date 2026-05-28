import { DEFAULT_MESH_COLORS, PREVIEW_HEIGHT, PREVIEW_WIDTH, WALLPAPER_TEXTURE } from '../constant'
import { clamp, drawCoverImage, getFlowEndpoints, loadImage, seededRandom } from '../helper'
import { renderMeshBase } from '../mesh'
import type {
  TImageTextureType,
  TMeshGradientRecipe,
  TTextureSwatchPalette,
  TTextureSurface,
  TWallpaperTexture,
} from '../spec'
import { renderAsciiTexture } from './ascii'
import { renderBeamTexture } from './beam'
import { renderDotsTexture } from './dots'
import { renderNoiseTexture } from './noise'
import { renderTileTexture } from './tile'

/**
 * Normalize external texture names and legacy aliases to supported values.
 *
 * @example
 * normalizeTextureType('halftone') // 'dots'
 */
export const normalizeTextureType = (type?: string): TImageTextureType => {
  if (type === 'mosaic') return WALLPAPER_TEXTURE.TILE
  if (type === 'dot' || type === 'halftone') return WALLPAPER_TEXTURE.DOTS
  if (
    type === WALLPAPER_TEXTURE.NOISE ||
    type === WALLPAPER_TEXTURE.TILE ||
    type === WALLPAPER_TEXTURE.BEAM ||
    type === WALLPAPER_TEXTURE.ASCII ||
    type === WALLPAPER_TEXTURE.DOTS
  ) {
    return type
  }

  return WALLPAPER_TEXTURE.NOISE
}

/**
 * Normalize a partial texture payload into the persisted descriptor shape.
 *
 * @example
 * normalizeTexture({ type: WALLPAPER_TEXTURE.ASCII, intensity: 55 })
 */
export const normalizeTexture = (
  value?: Partial<TWallpaperTexture> & { noise?: number },
): TWallpaperTexture => ({
  type: normalizeTextureType(value?.type),
  intensity: clamp(value?.intensity ?? value?.noise ?? 8, 0, 100),
  params: value?.params ?? {},
})

/**
 * Apply the selected Canvas texture renderer to a destination canvas.
 *
 * @example
 * renderTexture(ctx, sourceCanvas, 420, 260, texture, 'preview')
 */
export const renderTexture = (
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  width: number,
  height: number,
  texture: TWallpaperTexture,
  surface: TTextureSurface,
): void => {
  const intensity = clamp(texture.intensity, 0, 100)
  if (intensity <= 0) return

  if (texture.type === WALLPAPER_TEXTURE.NOISE) {
    renderNoiseTexture(ctx, width, height, intensity, surface)
  }

  if (texture.type === WALLPAPER_TEXTURE.TILE) {
    renderTileTexture(ctx, source, width, height, intensity, surface)
  }

  if (texture.type === WALLPAPER_TEXTURE.BEAM) {
    renderBeamTexture(ctx, source, width, height, intensity, surface)
  }

  if (texture.type === WALLPAPER_TEXTURE.ASCII) {
    renderAsciiTexture(ctx, source, width, height, intensity, surface)
  }

  if (texture.type === WALLPAPER_TEXTURE.DOTS) {
    renderDotsTexture(ctx, source, width, height, intensity, surface)
  }
}

/**
 * Render a textured image preview dataURL for picture/upload wallpaper.
 *
 * @example
 * await renderImageTextureDataUrl({ imageUrl, texture: WALLPAPER_TEXTURE.NOISE, intensity: 40 })
 */
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
  renderTexture(
    ctx,
    source,
    width,
    height,
    { type: texture, intensity: safeIntensity, params: {} },
    surface,
  )

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

/**
 * Render a textured gradient wallpaper dataURL for static fallback/export paths.
 *
 * @example
 * await renderGradientTextureDataUrl({ colors, direction: '180deg', texture: WALLPAPER_TEXTURE.ASCII })
 */
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
  const safeColors = colors.length ? colors : [...DEFAULT_MESH_COLORS]
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
  renderTexture(
    ctx,
    source,
    width,
    height,
    { type: texture, intensity: intensity, params: {} },
    surface,
  )

  return canvas.toDataURL('image/png')
}

/**
 * Render a mesh preview with a Canvas texture applied.
 *
 * @example
 * renderMeshTexturePreviewDataUrl({ recipe, texture })
 */
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

  const canvas = renderMeshBase(recipe, width, height)
  if (!canvas) return null

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const source = document.createElement('canvas')
  source.width = width
  source.height = height

  const sourceCtx = source.getContext('2d')
  if (!sourceCtx) return null

  sourceCtx.drawImage(canvas, 0, 0)
  renderTexture(ctx, source, width, height, texture, 'preview')

  return canvas.toDataURL('image/png')
}

/**
 * Render a small texture swatch preview used by picker buttons.
 *
 * @example
 * renderTextureSwatchDataUrl({ texture, palette })
 */
export const renderTextureSwatchDataUrl = ({
  texture,
  palette,
  width = 80,
  height = 80,
}: {
  texture: TWallpaperTexture
  palette: TTextureSwatchPalette
  width?: number
  height?: number
}): string | null => {
  if (typeof document === 'undefined') return null

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = palette.background
  ctx.fillRect(0, 0, width, height)

  const source = document.createElement('canvas')
  source.width = width
  source.height = height
  const sourceCtx = source.getContext('2d')
  if (!sourceCtx) return null

  const gradient = sourceCtx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, palette.background)
  gradient.addColorStop(0.52, palette.mid)
  gradient.addColorStop(1, palette.edge)
  sourceCtx.fillStyle = gradient
  sourceCtx.fillRect(0, 0, width, height)
  ctx.drawImage(source, 0, 0)

  renderTexture(ctx, source, width, height, texture, 'swatch')

  if (texture.type === WALLPAPER_TEXTURE.NOISE) {
    ctx.fillStyle = palette.digest
    ctx.globalAlpha = 0.22 + texture.intensity * 0.004
    const random = seededRandom(28711)
    for (let i = 0; i < 160; i += 1) {
      ctx.fillRect(Math.floor(random() * width), Math.floor(random() * height), 1, 1)
    }
    ctx.globalAlpha = 1
  }

  return canvas.toDataURL('image/png')
}
