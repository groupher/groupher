import { normalizeSignedAngle } from '~/lib/angle'
import { BG_RENDER_TYPE } from '~/lib/bg'
import { WALLPAPER_TEXTURE_SURFACE } from '~/lib/wallpaperMesh/constant'
import { drawCoverImage, getFlowEndpoints } from '~/lib/wallpaperMesh/helper'
import { renderMeshBase } from '~/lib/wallpaperMesh/mesh'
import { renderTexture } from '~/lib/wallpaperMesh/texture'

import { adaptCoverBgRenderSpec } from './background'
import { getImageCanvasCenter, getImageSize } from './salon/metric'
import type {
  TCoverConfig,
  TCoverExportMimeType,
  TCoverExportOptions,
  TCoverImageConfig,
  TExportedImageAsset,
} from './spec'

type TImageElement = HTMLImageElement

type TCoverExportLayer = {
  centerX: number
  centerY: number
  drawHeight: number
  drawWidth: number
  drawX: number
  drawY: number
  frameHeight: number
  frameWidth: number
  image: TCoverImageConfig
  rotate: number
}

const DEFAULT_EXPORT_FILENAME = 'cover.png'
const DEFAULT_EXPORT_MIME_TYPE: TCoverExportMimeType = 'image/png'

const parsePx = (value: string): number => Number.parseFloat(value) || 0

const roundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void => {
  const resolvedRadius = Math.max(0, Math.min(radius, width / 2, height / 2))

  ctx.beginPath()
  ctx.moveTo(x + resolvedRadius, y)
  ctx.lineTo(x + width - resolvedRadius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + resolvedRadius)
  ctx.lineTo(x + width, y + height - resolvedRadius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - resolvedRadius, y + height)
  ctx.lineTo(x + resolvedRadius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - resolvedRadius)
  ctx.lineTo(x, y + resolvedRadius)
  ctx.quadraticCurveTo(x, y, x + resolvedRadius, y)
  ctx.closePath()
}

const loadImageElement = (source: string): Promise<TImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()

    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Cover image export failed: image could not load.'))
    image.src = source
  })

const createSizedCanvas = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  return canvas
}

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  mimeType: TCoverExportMimeType,
  quality?: number,
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
          return
        }

        reject(new Error('Cover image export failed: canvas could not create a blob.'))
      },
      mimeType,
      quality,
    )
  })

const drawImageLayer = (
  ctx: CanvasRenderingContext2D,
  layer: TCoverExportLayer,
  imageElement: TImageElement,
): void => {
  const naturalWidth = imageElement.naturalWidth || layer.frameWidth
  const naturalHeight = imageElement.naturalHeight || layer.frameHeight
  const coverScale = Math.max(layer.frameWidth / naturalWidth, layer.frameHeight / naturalHeight)
  const baseWidth = naturalWidth * coverScale
  const baseHeight = naturalHeight * coverScale
  const cropOriginX = -layer.frameWidth / 2 + layer.image.crop.x * layer.frameWidth
  const cropOriginY = -layer.frameHeight / 2 + layer.image.crop.y * layer.frameHeight
  const baseX = -layer.frameWidth / 2 + (layer.frameWidth - baseWidth) * layer.image.crop.x
  const baseY = -layer.frameHeight / 2 + (layer.frameHeight - baseHeight) * layer.image.crop.y
  const zoom = Math.max(1, layer.image.crop.zoom)
  const drawX = cropOriginX + (baseX - cropOriginX) * zoom
  const drawY = cropOriginY + (baseY - cropOriginY) * zoom

  ctx.save()
  ctx.translate(layer.centerX, layer.centerY)
  ctx.rotate((layer.rotate * Math.PI) / 180)

  roundedRect(
    ctx,
    -layer.frameWidth / 2,
    -layer.frameHeight / 2,
    layer.frameWidth,
    layer.frameHeight,
    layer.image.borderRadius,
  )
  ctx.clip()
  ctx.drawImage(imageElement, drawX, drawY, baseWidth * zoom, baseHeight * zoom)
  ctx.restore()
}

const drawLinearGradientBackground = (
  ctx: CanvasRenderingContext2D,
  colors: string[],
  stops: number[],
  flow: number,
  width: number,
  height: number,
): void => {
  const endpoints = getFlowEndpoints(flow, width, height)
  const gradient = ctx.createLinearGradient(endpoints.x0, endpoints.y0, endpoints.x1, endpoints.y1)
  const colorCount = Math.max(colors.length - 1, 1)

  for (let index = 0; index < colors.length; index += 1) {
    const color = colors[index]
    gradient.addColorStop((stops[index] ?? (index / colorCount) * 100) / 100, color)
  }

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
}

const drawRadialGradientBackground = (
  ctx: CanvasRenderingContext2D,
  colors: string[],
  stops: number[],
  width: number,
  height: number,
): void => {
  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    0,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.72,
  )
  const colorCount = Math.max(colors.length - 1, 1)

  for (let index = 0; index < colors.length; index += 1) {
    const color = colors[index]
    gradient.addColorStop((stops[index] ?? (index / colorCount) * 100) / 100, color)
  }

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
}

const drawPatternOverlay = async (
  ctx: CanvasRenderingContext2D,
  imageUrl: string,
  color: string,
  opacity: number,
  width: number,
  height: number,
): Promise<void> => {
  if (!imageUrl || opacity <= 0) return

  const image = await loadImageElement(imageUrl)
  const mask = createSizedCanvas(width, height)
  const maskCtx = mask.getContext('2d')
  if (!maskCtx) return

  const pattern = maskCtx.createPattern(image, 'repeat')
  if (!pattern) return

  maskCtx.fillStyle = pattern
  maskCtx.fillRect(0, 0, width, height)
  maskCtx.globalCompositeOperation = 'source-in'
  maskCtx.fillStyle = color
  maskCtx.fillRect(0, 0, width, height)

  ctx.save()
  ctx.globalAlpha = opacity
  ctx.drawImage(mask, 0, 0)
  ctx.restore()
}

const drawCoverBackground = async (
  ctx: CanvasRenderingContext2D,
  config: TCoverConfig,
): Promise<void> => {
  const { canvasWidth: width, canvasHeight: height } = config
  const renderSpec = adaptCoverBgRenderSpec(config.activeBackground)
  const backgroundCanvas = createSizedCanvas(width, height)
  const backgroundCtx = backgroundCanvas.getContext('2d')

  if (!backgroundCtx) return

  if (renderSpec.type === BG_RENDER_TYPE.MESH_GRADIENT && renderSpec.meshRecipe) {
    const meshCanvas = renderMeshBase(renderSpec.meshRecipe, width, height)
    if (meshCanvas) backgroundCtx.drawImage(meshCanvas, 0, 0)
  } else if (renderSpec.type === BG_RENDER_TYPE.RADIAL_GRADIENT) {
    drawRadialGradientBackground(
      backgroundCtx,
      renderSpec.colors,
      renderSpec.colorStops,
      width,
      height,
    )
  } else if (renderSpec.type === BG_RENDER_TYPE.LINEAR_GRADIENT) {
    drawLinearGradientBackground(
      backgroundCtx,
      renderSpec.colors,
      renderSpec.colorStops,
      renderSpec.flow,
      width,
      height,
    )
  } else if (renderSpec.type === BG_RENDER_TYPE.IMAGE && renderSpec.imageUrl) {
    const image = await loadImageElement(renderSpec.imageUrl)
    drawCoverImage(backgroundCtx, image, width, height)
  } else if (renderSpec.background && renderSpec.background !== 'transparent') {
    backgroundCtx.fillStyle = renderSpec.background
    backgroundCtx.fillRect(0, 0, width, height)
  }

  if (renderSpec.hasTexture) {
    const source = createSizedCanvas(width, height)
    const sourceCtx = source.getContext('2d')
    if (sourceCtx) {
      sourceCtx.drawImage(backgroundCanvas, 0, 0)
      renderTexture(
        backgroundCtx,
        source,
        width,
        height,
        renderSpec.texture,
        WALLPAPER_TEXTURE_SURFACE.WALLPAPER,
      )
    }
  }

  await drawPatternOverlay(
    backgroundCtx,
    renderSpec.patternImage,
    renderSpec.patternColor,
    renderSpec.hasPattern ? renderSpec.patternOpacity : 0,
    width,
    height,
  )

  ctx.save()
  ctx.filter = renderSpec.filter
  ctx.drawImage(backgroundCanvas, 0, 0)
  ctx.restore()
}

export const getCoverExportLayers = (config: TCoverConfig): TCoverExportLayer[] => {
  const canvas = { canvasWidth: config.canvasWidth, canvasHeight: config.canvasHeight }

  return ([config.images.primary, config.images.secondary].filter(Boolean) as TCoverImageConfig[])
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((image) => {
      const rotate = normalizeSignedAngle(image.rotate)
      const center = getImageCanvasCenter(image.position, image.size, rotate, canvas)
      const imageSize = getImageSize(image.size, canvas)
      const frameWidth = parsePx(imageSize.width)
      const frameHeight = parsePx(imageSize.height)
      const cropX = image.crop.x * frameWidth
      const cropY = image.crop.y * frameHeight
      const zoom = Math.max(1, image.crop.zoom)
      const drawWidth = frameWidth * zoom
      const drawHeight = frameHeight * zoom
      const drawX = -frameWidth / 2 + cropX - cropX * zoom
      const drawY = -frameHeight / 2 + cropY - cropY * zoom

      return {
        centerX: center.x,
        centerY: center.y,
        drawHeight,
        drawWidth,
        drawX,
        drawY,
        frameHeight,
        frameWidth,
        image,
        rotate,
      }
    })
}

export const exportFinalImage = async (
  config: TCoverConfig,
  options: TCoverExportOptions = {},
): Promise<TExportedImageAsset> => {
  const layers = getCoverExportLayers(config)

  if (layers.length === 0) {
    throw new Error('Cover image export failed: no image is selected.')
  }

  const canvas = document.createElement('canvas')
  canvas.width = config.canvasWidth
  canvas.height = config.canvasHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Cover image export failed: canvas is not available.')

  if (options.backgroundColor) {
    ctx.fillStyle = options.backgroundColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  await drawCoverBackground(ctx, config)

  const imageElements = await Promise.all(
    layers.map((layer) => loadImageElement(layer.image.source)),
  )

  for (const [index, layer] of layers.entries()) {
    drawImageLayer(ctx, layer, imageElements[index])
  }

  const mimeType = options.mimeType ?? DEFAULT_EXPORT_MIME_TYPE
  const blob = await canvasToBlob(canvas, mimeType, options.quality)

  return {
    blob,
    filename: options.filename ?? DEFAULT_EXPORT_FILENAME,
    height: canvas.height,
    mimeType,
    width: canvas.width,
  }
}
