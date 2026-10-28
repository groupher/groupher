import { frame, init, surface } from 'vgpu'
import type { Gpu } from 'vgpu'

import { DEFAULT_WALLPAPER_EXPORT_SIZE, DEFAULT_WALLPAPER_PATTERN_SIZE } from '~/lib/bg'
import type { TBgRenderSpec } from '~/lib/bg'

import { isVgpuWallpaperSpec } from './eligibility'
import { createWallpaperMesh } from './mesh'
import { toVgpuMeshParams } from './params'
import {
  createPatternFallbackTexture,
  getPatternRepeat,
  loadPatternTexture,
  type TPatternTexture,
} from './pattern'
import { createWallpaperPostProcess } from './postProcess'
import './wgsl-env.d.ts'

const DEFAULT_WEBP_QUALITY = 0.86
const DEFAULT_WEBP_BUDGET_BYTES = 800 * 1024
const DEFAULT_EXPORT_FILENAME = 'wallpaper.webp'
const GPU_INIT_TIMEOUT_MS = 10_000

export type TVgpuWallpaperExportOptions = {
  filename?: string
  logicalSize?: readonly [number, number]
  maxBytes?: number
  patternSize?: string
  quality?: number
  size?: readonly [number, number]
}

export type TVgpuWallpaperExport = {
  blob: Blob
  file: File
  filename: string
  height: number
  mimeType: 'image/webp'
  width: number
}

export type TVgpuWallpaperExportJob = {
  options?: TVgpuWallpaperExportOptions
  renderSpec: TBgRenderSpec
  targetKey?: string
}

export type TVgpuWallpaperBatchExport = TVgpuWallpaperExport & {
  targetKey: string
}

const initGpuWithTimeout = async (): Promise<Gpu> => {
  let timedOut = false
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const initPromise = init({ label: 'wallpaper-vgpu-export', powerPreference: 'high-performance' })
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true
      reject(
        new Error(`BG_VGPU_EXPORT_INIT_TIMEOUT: WebGPU init exceeded ${GPU_INIT_TIMEOUT_MS}ms`),
      )
    }, GPU_INIT_TIMEOUT_MS)
  })

  try {
    return await Promise.race([initPromise, timeoutPromise])
  } catch (error) {
    if (timedOut) {
      void initPromise.then((lateGpu) => lateGpu.dispose()).catch(() => undefined)
    }
    throw error
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
  }
}

const normalizeExportSize = (size: readonly [number, number]): readonly [number, number] => {
  const [width, height] = size
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error('BG_VGPU_EXPORT_INVALID_SIZE: export size must contain positive integers')
  }

  return [width, height]
}

const canvasToWebp = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('BG_VGPU_EXPORT_ENCODE_FAILED: Canvas WebP encoding returned no blob'))
          return
        }

        if (blob.type !== 'image/webp') {
          reject(
            new Error(
              `BG_VGPU_EXPORT_INVALID_MIME: expected image/webp, got ${blob.type || 'unknown'}`,
            ),
          )
          return
        }

        resolve(blob)
      },
      'image/webp',
      quality,
    )
  })

const assertWebpDimensions = async (
  blob: Blob,
  expectedSize: readonly [number, number],
): Promise<void> => {
  const bitmap = await createImageBitmap(blob)
  try {
    if (bitmap.width !== expectedSize[0] || bitmap.height !== expectedSize[1]) {
      throw new Error(
        `BG_VGPU_EXPORT_INVALID_DIMENSIONS: expected ${expectedSize[0]}x${expectedSize[1]}, got ${bitmap.width}x${bitmap.height}`,
      )
    }
  } finally {
    bitmap.close()
  }
}

const normalizeExportOptions = (options: TVgpuWallpaperExportOptions) => {
  const size = normalizeExportSize(options.size ?? DEFAULT_WALLPAPER_EXPORT_SIZE)
  const logicalSize = normalizeExportSize(options.logicalSize ?? size)
  const quality = Math.min(1, Math.max(0, options.quality ?? DEFAULT_WEBP_QUALITY))
  const maxBytes = options.maxBytes ?? DEFAULT_WEBP_BUDGET_BYTES
  const filename = options.filename ?? DEFAULT_EXPORT_FILENAME
  const patternSize = options.patternSize ?? DEFAULT_WALLPAPER_PATTERN_SIZE

  if (!filename.trim()) throw new Error('BG_VGPU_EXPORT_INVALID_FILENAME: filename cannot be empty')
  if (!Number.isInteger(maxBytes) || maxBytes <= 0) {
    throw new Error('BG_VGPU_EXPORT_INVALID_BUDGET: maxBytes must be a positive integer')
  }

  return { filename, logicalSize, maxBytes, patternSize, quality, size }
}

/**
 * Renders several supported Wallpaper specs with one WebGPU device and shared source textures.
 *
 * Each job still receives an independent surface and output bitmap, so profiles are composed at
 * their own logical aspect ratio. The GPU device, sampler, pattern textures, and source image
 * textures are shared for the lifetime of the batch.
 */
export const exportVgpuWallpaperBatch = async (
  jobs: readonly TVgpuWallpaperExportJob[],
): Promise<TVgpuWallpaperBatchExport[]> => {
  if (jobs.length === 0) return []
  for (const { renderSpec } of jobs) {
    if (!isVgpuWallpaperSpec(renderSpec)) {
      throw new Error(
        'BG_VGPU_EXPORT_UNSUPPORTED_SPEC: only supported gradient, mesh, and image wallpapers are supported',
      )
    }
  }
  if (typeof navigator === 'undefined' || !navigator.gpu) {
    throw new Error('BG_VGPU_EXPORT_WEBGPU_UNAVAILABLE: current browser does not provide WebGPU')
  }

  const normalizedJobs = jobs.map((job, index) => ({
    ...job,
    normalized: normalizeExportOptions(job.options ?? {}),
    targetKey: job.targetKey ?? String(index),
  }))
  const gpu = await initGpuWithTimeout()
  const asyncErrors: Error[] = []
  const unsubscribeError = gpu.onError((error) => asyncErrors.push(error))
  const patternSampler = gpu.gpu.createSampler({
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
    magFilter: 'linear',
    minFilter: 'linear',
  })
  const fallbackTexture = createPatternFallbackTexture(gpu.gpu, 'wallpaper-vgpu-batch-fallback')
  const textureCache = new Map<string, Promise<TPatternTexture>>()
  const ownedTextures = new Set<TPatternTexture>([fallbackTexture])

  const getTexture = (url: string): Promise<TPatternTexture> => {
    if (!url) return Promise.resolve(fallbackTexture)

    const cached = textureCache.get(url)
    if (cached) return cached

    const texture = loadPatternTexture(gpu.gpu, url).then((loaded) => {
      ownedTextures.add(loaded)
      return loaded
    })
    textureCache.set(url, texture)
    return texture
  }

  const renderJob = async ({
    normalized,
    renderSpec,
    targetKey,
  }: (typeof normalizedJobs)[number]): Promise<TVgpuWallpaperBatchExport> => {
    const { filename, logicalSize, maxBytes, patternSize, quality, size } = normalized
    const canvas = document.createElement('canvas')
    canvas.width = size[0]
    canvas.height = size[1]
    const exportSurface = surface(gpu, canvas, {
      autoResize: false,
      dpr: 1,
      size,
      alphaMode: 'premultiplied',
      clearColor: [0, 0, 0, 0],
      label: `wallpaper-vgpu-export-surface-${targetKey}`,
    })
    const postProcess = createWallpaperPostProcess(gpu)

    try {
      if (canvas.width !== size[0] || canvas.height !== size[1]) {
        throw new Error(
          `BG_VGPU_EXPORT_INVALID_CANVAS_SIZE: expected ${size[0]}x${size[1]}, got ${canvas.width}x${canvas.height}`,
        )
      }

      const patternTexture = renderSpec.hasPattern
        ? await getTexture(renderSpec.patternImage)
        : fallbackTexture
      const imageTexture =
        renderSpec.type === 'image' ? await getTexture(renderSpec.imageUrl) : fallbackTexture
      const meshParams = toVgpuMeshParams(
        renderSpec,
        getPatternRepeat(logicalSize, patternSize, [patternTexture.width, patternTexture.height]),
      )
      meshParams.resolution = [size[0], size[1]]
      meshParams.imageSize = [imageTexture.width, imageTexture.height]
      meshParams.imageReady = renderSpec.type === 'image' ? 1 : 0
      const mesh = createWallpaperMesh(gpu, meshParams, `wallpaper-vgpu-export-mesh-${targetKey}`)
      mesh.set({
        params: meshParams,
        patternSampler,
        patternTexture: patternTexture.texture,
        imageSampler: patternSampler,
        imageTexture: imageTexture.texture,
      })

      const errorCount = asyncErrors.length
      postProcess.update(size, meshParams)
      await mesh.compile(postProcess.scene)
      await postProcess.compile(exportSurface)
      const currentFrame = frame(gpu, (gpuFrame) => {
        postProcess.encode(gpuFrame, exportSurface, mesh)
      })
      await currentFrame.done
      await gpu.settled()
      if (asyncErrors.length > errorCount) throw asyncErrors[errorCount]

      const blob = await canvasToWebp(canvas, quality)
      await assertWebpDimensions(blob, size)
      if (blob.size > maxBytes) {
        throw new Error(
          `BG_VGPU_EXPORT_TOO_LARGE: WebP is ${blob.size} bytes, limit is ${maxBytes} bytes`,
        )
      }

      const file = new File([blob], filename, { type: 'image/webp' })
      return {
        blob,
        file,
        filename,
        height: size[1],
        mimeType: 'image/webp',
        targetKey,
        width: size[0],
      }
    } finally {
      exportSurface.dispose()
      postProcess.destroy()
    }
  }

  try {
    const results: TVgpuWallpaperBatchExport[] = []
    for (const job of normalizedJobs) results.push(await renderJob(job))
    return results
  } finally {
    unsubscribeError()
    for (const texture of ownedTextures) texture.texture.destroy()
    gpu.dispose()
  }
}

/**
 * Renders a supported wallpaper spec to a fixed-size WebP Blob.
 *
 * The module is intentionally kept behind the editor/export dynamic-import boundary. It uses
 * the same WGSL shader and uniform mapping as the live vgpu renderer, but creates an independent
 * GPU device and surface for one export operation.
 *
 * @example
 * const { exportVgpuWallpaper } = await import('~/render/BgRenderer/vgpu/export')
 * const exported = await exportVgpuWallpaper(renderSpec)
 */
export const exportVgpuWallpaper = async (
  renderSpec: TBgRenderSpec,
  options: TVgpuWallpaperExportOptions = {},
): Promise<TVgpuWallpaperExport> => {
  const [exported] = await exportVgpuWallpaperBatch([{ options, renderSpec }])
  const { targetKey: _targetKey, ...result } = exported!
  return result
}
