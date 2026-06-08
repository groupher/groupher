export type TDominantImageColor = {
  css: string
  hex: string
  rgb: {
    b: number
    g: number
    r: number
  }
}

type TBucket = {
  b: number
  count: number
  g: number
  r: number
}

type TDetectOptions = {
  bucketSize?: number
  sampleSize?: number
}

const DEFAULT_SAMPLE_SIZE = 48
const DEFAULT_BUCKET_SIZE = 24
const MIN_ALPHA = 16
const BACKGROUND_EDGE = 246

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

const toHexPair = (value: number): string => clamp(value, 0, 255).toString(16).padStart(2, '0')

/**
 * Convert an RGB triplet into a browser-ready hex color.
 *
 * @example
 * rgbToHex({ r: 210, g: 86, b: 62 }) // '#d2563e'
 */
export const rgbToHex = ({ b, g, r }: TDominantImageColor['rgb']): string =>
  `#${toHexPair(r)}${toHexPair(g)}${toHexPair(b)}`

const isLowSignalPixel = (r: number, g: number, b: number, alpha: number): boolean => {
  if (alpha < MIN_ALPHA) return true

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)

  return max >= BACKGROUND_EDGE && min >= BACKGROUND_EDGE
}

const bucketKey = (r: number, g: number, b: number, bucketSize: number): string =>
  [r, g, b].map((value) => Math.floor(value / bucketSize)).join(':')

/**
 * Pick the dominant visible color from raw RGBA pixels.
 *
 * The function is intentionally DOM-free so browser image sampling can keep
 * this color-ranking logic covered by unit tests.
 *
 * @example
 * const color = getDominantColorFromPixels(imageData.data)
 * color?.css // 'rgb(210, 86, 62)'
 */
export const getDominantColorFromPixels = (
  pixels: Uint8ClampedArray,
  options: Pick<TDetectOptions, 'bucketSize'> = {},
): TDominantImageColor | null => {
  const bucketSize = clamp(options.bucketSize ?? DEFAULT_BUCKET_SIZE, 1, 255)
  const buckets = new Map<string, TBucket>()
  let fallback: TBucket | null = null

  for (let index = 0; index < pixels.length; index += 4) {
    const r = pixels[index]
    const g = pixels[index + 1]
    const b = pixels[index + 2]
    const alpha = pixels[index + 3]

    if (alpha < MIN_ALPHA) continue

    if (!fallback) fallback = { r: 0, g: 0, b: 0, count: 0 }
    fallback.r += r
    fallback.g += g
    fallback.b += b
    fallback.count += 1

    if (isLowSignalPixel(r, g, b, alpha)) continue

    const key = bucketKey(r, g, b, bucketSize)
    const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, count: 0 }

    bucket.r += r
    bucket.g += g
    bucket.b += b
    bucket.count += 1
    buckets.set(key, bucket)
  }

  const dominant =
    Array.from(buckets.values()).sort((left, right) => right.count - left.count)[0] ?? fallback

  if (!dominant || dominant.count <= 0) return null

  const rgb = {
    r: Math.round(dominant.r / dominant.count),
    g: Math.round(dominant.g / dominant.count),
    b: Math.round(dominant.b / dominant.count),
  }
  const hex = rgbToHex(rgb)

  return { css: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`, hex, rgb }
}

/**
 * Sample a loaded image element with canvas and return its dominant color.
 *
 * Returns null when the image is not measurable or canvas pixel reads are
 * blocked, for example by a cross-origin image without CORS headers.
 *
 * @example
 * const color = extractDominantColorFromImage(event.currentTarget)
 * preview.style.backgroundColor = color?.css ?? ''
 */
export const extractDominantColorFromImage = (
  image: HTMLImageElement,
  options: TDetectOptions = {},
): TDominantImageColor | null => {
  const sourceWidth = image.naturalWidth || image.width
  const sourceHeight = image.naturalHeight || image.height

  if (sourceWidth <= 0 || sourceHeight <= 0) return null

  const sampleSize = clamp(options.sampleSize ?? DEFAULT_SAMPLE_SIZE, 1, 160)
  const scale = Math.min(sampleSize / sourceWidth, sampleSize / sourceHeight, 1)
  const width = Math.max(1, Math.round(sourceWidth * scale))
  const height = Math.max(1, Math.round(sourceHeight * scale))
  const canvas = document.createElement('canvas')

  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  try {
    ctx.drawImage(image, 0, 0, width, height)
    return getDominantColorFromPixels(ctx.getImageData(0, 0, width, height).data, options)
  } catch {
    return null
  }
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()

    image.decoding = 'async'
    if (!src.startsWith('blob:') && !src.startsWith('data:')) image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    image.src = src
  })

/**
 * Load or inspect an image source and resolve its dominant color.
 *
 * Prefer `extractDominantColorFromImage` inside an existing `<img onLoad>`
 * path to avoid reloading the same image. Use this wrapper when callers only
 * have a URL or an image element that may not have finished loading yet.
 *
 * @example
 * const color = await detectImageDominantColor('/cover.png')
 * card.style.backgroundColor = color?.css ?? 'var(--color-primary)'
 */
export const detectImageDominantColor = async (
  source: HTMLImageElement | string,
  options: TDetectOptions = {},
): Promise<TDominantImageColor | null> => {
  try {
    const image = typeof source === 'string' ? await loadImage(source) : source

    if (!image.complete && typeof source !== 'string') {
      await new Promise<void>((resolve, reject) => {
        image.addEventListener('load', () => resolve(), { once: true })
        image.addEventListener('error', () => reject(new Error('Failed to load image element')), {
          once: true,
        })
      })
    }

    return extractDominantColorFromImage(image, options)
  } catch {
    return null
  }
}
