import { CANVAS_HEIGHT, CANVAS_WIDTH } from './constant'

/**
 * Clamp a numeric config value into the renderer-supported range.
 *
 * @example
 * clamp(120, 0, 100) // 100
 */
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

/**
 * Calculate perceived luminance for texture masks.
 *
 * @example
 * getLuminance(255, 255, 255) // 1
 */
export const getLuminance = (r: number, g: number, b: number): number =>
  (r * 0.299 + g * 0.587 + b * 0.114) / 255

/**
 * Create deterministic pseudo-random values for stable texture previews.
 *
 * @example
 * const random = seededRandom(91283)
 * random() // same first value for the same seed
 */
export const seededRandom = (seed: number) => {
  let value = seed || 1

  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296
    return value / 4294967296
  }
}

/**
 * Load an image element before drawing it into a preview canvas.
 *
 * @example
 * const image = await loadImage('/wallpaper/picture/backiee-1.webp')
 */
export const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = url
  })

/**
 * Draw an image using CSS background-size: cover semantics.
 *
 * @example
 * drawCoverImage(ctx, image, 360, 170)
 */
export const drawCoverImage = (
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

/**
 * Convert a degree flow into linear-gradient endpoints for canvas rendering.
 *
 * @example
 * getFlowEndpoints(180, 960, 600)
 */
export const getFlowEndpoints = (flow: number, width = CANVAS_WIDTH, height = CANVAS_HEIGHT) => {
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
