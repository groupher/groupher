import { effect, frame, init, surface, target } from 'vgpu'
import type { Gpu, Surface, Target } from 'vgpu'

import { createWallpaperMesh } from '../vgpu/mesh'
import orientationShader from './orientation.wgsl'
import { toVgpuMeshParams } from './params'
import type {
  TVgpuPocController,
  TVgpuPocMeshSpec,
  TVgpuPocModel,
  TVgpuPocRenderReport,
} from './types'

const EXPORT_SIZE = [1200, 630] as const
const WEBP_BUDGET_BYTES = 800 * 1024
const GPU_INIT_TIMEOUT_MS = 10_000

const canvasToWebp = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas WebP encoding returned no blob'))
          return
        }

        if (blob.type !== 'image/webp') {
          reject(
            new Error(
              `BG_VGPU_POC_INVALID_MIME: expected image/webp, got ${blob.type || 'unknown'}`,
            ),
          )
          return
        }

        resolve(blob)
      },
      'image/webp',
      0.86,
    )
  })

const decodeImageSize = async (blob: Blob): Promise<readonly [number, number]> => {
  const bitmap = await createImageBitmap(blob)
  try {
    return [bitmap.width, bitmap.height]
  } finally {
    bitmap.close()
  }
}

const sizeMatches = (
  actual: readonly [number, number],
  expected: readonly [number, number],
): boolean => actual[0] === expected[0] && actual[1] === expected[1]

const initGpuWithTimeout = async (): Promise<Gpu> => {
  let timedOut = false
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const initPromise = init({ label: 'wallpaper-vgpu-poc', powerPreference: 'high-performance' })
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true
      reject(new Error(`VGPU_POC_INIT_TIMEOUT: WebGPU init exceeded ${GPU_INIT_TIMEOUT_MS}ms`))
    }, GPU_INIT_TIMEOUT_MS)
  })

  try {
    return await Promise.race([initPromise, timeoutPromise])
  } catch (error) {
    if (timedOut) {
      // init() has no AbortSignal. Dispose a device that resolves after the caller already fell back.
      void initPromise.then((lateGpu) => lateGpu.dispose()).catch(() => undefined)
    }
    throw error
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
  }
}

const readPixel = (pixels: Uint8Array, width: number, x: number, y: number): readonly number[] => {
  const offset = (y * width + x) * 4
  return Array.from(pixels.slice(offset, offset + 4))
}

const renderMesh = async (
  gpu: Gpu,
  canvas: HTMLCanvasElement,
  spec: TVgpuPocMeshSpec,
): Promise<{ report: TVgpuPocRenderReport; blob: Blob; surface: Surface; target: Target }> => {
  const canvasSurface = surface(gpu, canvas, {
    autoResize: false,
    dpr: 1,
    size: EXPORT_SIZE,
    alphaMode: 'premultiplied',
    label: `wallpaper-${spec.model}-surface`,
  })
  const offscreen = target(gpu, {
    size: EXPORT_SIZE,
    format: 'rgba8unorm',
    label: `wallpaper-${spec.model}-export`,
  })
  const mesh = createWallpaperMesh(gpu, toVgpuMeshParams(spec), `wallpaper-${spec.model}`)

  await Promise.all([
    mesh.compile(offscreen),
    mesh.compile({ colors: [canvasSurface.format], sampleCount: canvasSurface.sampleCount }),
  ])
  const renderStartedAt = performance.now()
  frame(gpu, (currentFrame) => {
    currentFrame.pass(offscreen, mesh)
    currentFrame.pass(canvasSurface, mesh)
  })
  await gpu.gpu.queue.onSubmittedWorkDone()
  const renderMs = performance.now() - renderStartedAt

  const readbackStartedAt = performance.now()
  const pixels = await offscreen.read()
  const readbackMs = performance.now() - readbackStartedAt
  const blob = await canvasToWebp(canvas)
  const canvasBackingSize = [canvas.width, canvas.height] as const
  const webpDecodedSize = await decodeImageSize(blob)
  const expectedReadbackBytes = EXPORT_SIZE[0] * EXPORT_SIZE[1] * 4

  return {
    report: {
      model: spec.model,
      size: EXPORT_SIZE,
      canvasBackingSize,
      canvasBackingSizeMatches: sizeMatches(canvasBackingSize, EXPORT_SIZE),
      renderMs,
      readbackMs,
      readbackBytes: pixels.byteLength,
      expectedReadbackBytes,
      readbackIsContiguousRgba: pixels.byteLength === expectedReadbackBytes,
      webpBytes: blob.size,
      webpMime: blob.type,
      webpDecodedSize,
      webpDimensionsMatch: sizeMatches(webpDecodedSize, EXPORT_SIZE),
      webpUnder800Kb: blob.size <= WEBP_BUDGET_BYTES,
    },
    blob,
    surface: canvasSurface,
    target: offscreen,
  }
}

const validateTopOrigin = async (
  gpu: Gpu,
): Promise<{
  topOriginReadback: boolean
  topPixel: readonly number[]
  bottomPixel: readonly number[]
}> => {
  const width = 4
  const height = 4
  const orientationTarget = target(gpu, {
    size: [width, height],
    format: 'rgba8unorm',
    label: 'wallpaper-orientation-check',
  })
  const orientation = effect(gpu, orientationShader, { label: 'wallpaper-orientation' })

  await orientation.compile(orientationTarget)
  frame(gpu, (currentFrame) => currentFrame.pass(orientationTarget, orientation))
  const pixels = await orientationTarget.read()
  const topPixel = readPixel(pixels, width, 0, 0)
  const bottomPixel = readPixel(pixels, width, 0, height - 1)

  return {
    topOriginReadback:
      topPixel[0] >= 250 && topPixel[2] <= 5 && bottomPixel[0] <= 5 && bottomPixel[2] >= 250,
    topPixel,
    bottomPixel,
  }
}

/**
 * Runs the isolated browser POC and returns its reports, WebP files, and explicit GPU cleanup.
 */
export const runVgpuWallpaperPoc = async (
  canvases: Readonly<Record<TVgpuPocModel, HTMLCanvasElement>>,
  specs: readonly [TVgpuPocMeshSpec, TVgpuPocMeshSpec],
): Promise<TVgpuPocController> => {
  const models = new Set(specs.map((spec) => spec.model))
  if (models.size !== 2 || !models.has('flow') || !models.has('liquid')) {
    throw new Error('VGPU_POC_REQUIRES_FLOW_AND_LIQUID_SPECS')
  }

  const initStartedAt = performance.now()
  const gpu = await initGpuWithTimeout()
  const initMs = performance.now() - initStartedAt
  const asyncErrors: string[] = []
  const unsubscribeError = gpu.onError((error) => asyncErrors.push(error.message))
  const resources: Array<Surface | Target> = []
  const exports = {} as Record<TVgpuPocModel, Blob>

  try {
    const renders: TVgpuPocRenderReport[] = []
    for (const spec of specs) {
      const result = await renderMesh(gpu, canvases[spec.model], spec)
      renders.push(result.report)
      exports[spec.model] = result.blob
      resources.push(result.surface, result.target)
    }

    const orientation = await validateTopOrigin(gpu)
    await gpu.settled()

    return {
      report: {
        supported: true,
        deviceLabel: gpu.gpu.label || 'browser-default-device',
        initMs,
        initTimeoutMs: GPU_INIT_TIMEOUT_MS,
        typedWgslImport: true,
        uvOrigin: 'top-left',
        ...orientation,
        asyncErrors,
        renders,
      },
      exports,
      dispose: () => {
        unsubscribeError()
        for (const resource of resources) {
          if ('dispose' in resource) resource.dispose()
        }
        gpu.dispose()
      },
    }
  } catch (error) {
    unsubscribeError()
    gpu.dispose()
    throw error
  }
}
