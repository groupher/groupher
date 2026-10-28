import { frame, surface } from 'vgpu'
import type { Draw, Gpu, Surface } from 'vgpu'

import type { TBgRenderSpec } from '~/lib/bg'

import { createWallpaperMesh, getWallpaperVariantKey } from './mesh'
import { toVgpuBlurRadius, toVgpuMeshParams } from './params'
import {
  createPatternFallbackTexture,
  getPatternRepeat,
  loadPatternTexture,
  type TPatternTexture,
} from './pattern'
import { createWallpaperPostProcess } from './postProcess'
import { resolvePreviewSurfaceSize } from './previewSize'
import { acquireWallpaperGpu } from './sharedGpu'
import './wgsl-env.d.ts'

const getStaticParamsKey = (renderSpec: TBgRenderSpec): string => {
  const meshRecipe = renderSpec.meshRecipe

  return [
    renderSpec.type,
    renderSpec.colors.join(','),
    renderSpec.colorStops.join(','),
    meshRecipe?.renderer ?? '',
    meshRecipe?.softness ?? 0,
    meshRecipe?.seed ?? 1,
    meshRecipe?.warp ?? 55,
    meshRecipe?.scale ?? 55,
    meshRecipe?.brightness ?? 100,
    meshRecipe?.contrast ?? 100,
    renderSpec.gradientRecipe?.renderer ?? '',
    renderSpec.gradientRecipe?.renderer === 'radial' ? renderSpec.gradientRecipe.center.x : 0.5,
    renderSpec.gradientRecipe?.renderer === 'radial' ? renderSpec.gradientRecipe.center.y : 0.5,
    renderSpec.gradientRecipe?.renderer === 'radial' ? renderSpec.gradientRecipe.radius : 72,
    renderSpec.hasTexture ? renderSpec.texture.type : '',
    renderSpec.type === 'image' ? renderSpec.imageUrl : '',
    renderSpec.patternColor,
  ].join('|')
}

export type TBgVgpuRenderer = {
  update: (renderSpec: TBgRenderSpec) => void
  updatePreviewFrame: (renderSpec: TBgRenderSpec) => void
  resize: () => void
  destroy: () => void
}

class BgVgpuRenderer implements TBgVgpuRenderer {
  private readonly gpu: Gpu
  private readonly canvas: HTMLCanvasElement
  private readonly canvasSurface: Surface
  private readonly patternFallback: TPatternTexture
  private readonly imageFallback: TPatternTexture
  private readonly patternSampler: GPUSampler
  private readonly meshes = new Map<string, Draw>()
  private readonly releaseGpu: () => void
  private readonly postProcess: ReturnType<typeof createWallpaperPostProcess>
  private readonly onFailure: (error: Error) => void
  private readonly unsubscribeError: () => void
  private renderSpec: TBgRenderSpec
  private frameId: number | null = null
  private renderInFlight = false
  private renderQueued = false
  private ready = false
  private disposed = false
  private failed = false
  private readonly startupErrors: Error[] = []
  private patternTexture: TPatternTexture
  private imageTexture: TPatternTexture
  private patternTextureUrl = ''
  private patternLoadingUrl = ''
  private patternLoadToken = 0
  private patternReady = false
  private imageReady = false
  private imageUrl = ''
  private imageLoadingUrl = ''
  private imageWidth = 1
  private imageHeight = 1
  private imageLoadToken = 0
  private logicalSize: readonly [number, number] = [1, 1]
  private sizeDirty = true
  private paramsDirty = true
  private paramsKey = ''
  private meshParams: Record<string, unknown> | null = null
  private readonly patternSize: string
  private readonly renderSize: readonly [number, number] | undefined
  private readonly renderLogicalSize: readonly [number, number] | undefined

  constructor(
    gpu: Gpu,
    releaseGpu: () => void,
    canvas: HTMLCanvasElement,
    renderSpec: TBgRenderSpec,
    onFailure: (error: Error) => void,
    patternSize = 'auto',
    renderSize?: readonly [number, number],
    renderLogicalSize?: readonly [number, number],
  ) {
    this.gpu = gpu
    this.releaseGpu = releaseGpu
    this.canvas = canvas
    this.renderSpec = renderSpec
    this.patternSize = patternSize
    this.renderSize = renderSize
    this.renderLogicalSize = renderLogicalSize
    this.onFailure = onFailure
    const cleanup: Array<() => void> = []
    try {
      this.canvasSurface = surface(gpu, canvas, {
        autoResize: false,
        alphaMode: 'premultiplied',
        clearColor: [0, 0, 0, 0],
        label: 'wallpaper-runtime-surface',
      })
      cleanup.push(() => this.canvasSurface.dispose())
      this.patternFallback = createPatternFallbackTexture(
        gpu.gpu,
        'wallpaper-vgpu-pattern-fallback',
      )
      cleanup.push(() => this.patternFallback.texture.destroy())
      this.patternTexture = this.patternFallback
      this.imageFallback = createPatternFallbackTexture(gpu.gpu, 'wallpaper-vgpu-image-fallback')
      cleanup.push(() => this.imageFallback.texture.destroy())
      this.imageTexture = this.imageFallback
      this.patternSampler = gpu.gpu.createSampler({
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge',
        magFilter: 'linear',
        minFilter: 'linear',
      })
      this.unsubscribeError = gpu.onError((error) => {
        if (this.ready) this.fail(error)
        else this.startupErrors.push(error)
      })
      cleanup.push(this.unsubscribeError)
      this.postProcess = createWallpaperPostProcess(gpu)
    } catch (error) {
      for (const dispose of cleanup.reverse()) dispose()
      throw error
    }
  }

  async prepare(): Promise<void> {
    await Promise.all([this.syncPatternTexture(), this.syncImageTexture()])
    await this.postProcess.compile(this.canvasSurface)
    await this.renderImmediately()
    await this.gpu.settled()
    if (this.startupErrors.length > 0) throw this.startupErrors[0]

    this.ready = true
    void this.gpu.gpu.lost.then((info) => {
      if (this.disposed) return
      this.fail(new Error(`BG_VGPU_DEVICE_LOST: ${info.message || info.reason}`))
    })
  }

  update(renderSpec: TBgRenderSpec): void {
    this.renderSpec = renderSpec
    this.paramsDirty = true
    void this.syncPatternTexture().catch((error) =>
      this.fail(error instanceof Error ? error : new Error(String(error))),
    )
    void this.syncImageTexture().catch((error) =>
      this.fail(error instanceof Error ? error : new Error(String(error))),
    )
    this.scheduleRender()
  }

  updatePreviewFrame(renderSpec: TBgRenderSpec): void {
    const previousParamsKey = this.paramsKey
    const previousPatternImage = this.renderSpec.patternImage
    this.renderSpec = renderSpec
    if (previousParamsKey !== getStaticParamsKey(renderSpec)) this.paramsDirty = true

    if (previousPatternImage !== renderSpec.patternImage) {
      void this.syncPatternTexture().catch((error) =>
        this.fail(error instanceof Error ? error : new Error(String(error))),
      )
    }
    if (renderSpec.imageUrl !== this.imageUrl) {
      void this.syncImageTexture().catch((error) =>
        this.fail(error instanceof Error ? error : new Error(String(error))),
      )
    }
    this.scheduleRender()
  }

  resize(): void {
    this.sizeDirty = true
    this.scheduleRender()
  }

  destroy(): void {
    if (this.disposed) return

    this.disposed = true
    if (this.frameId !== null) {
      window.cancelAnimationFrame(this.frameId)
      this.frameId = null
    }
    this.renderQueued = false
    this.unsubscribeError()
    this.canvasSurface.dispose()
    this.postProcess.destroy()
    this.deferDestroy(this.patternTexture.texture, true)
    if (this.patternFallback.texture !== this.patternTexture.texture) {
      this.deferDestroy(this.patternFallback.texture, true)
    }
    this.deferDestroy(this.imageTexture.texture, true)
    if (this.imageFallback.texture !== this.imageTexture.texture) {
      this.deferDestroy(this.imageFallback.texture, true)
    }
    this.meshes.clear()
    this.releaseGpu()
  }

  private scheduleRender(): void {
    // Texture loading during prepare must not race the explicit first-frame compile/render.
    if (this.disposed || !this.ready) return

    this.renderQueued = true
    if (this.renderInFlight || this.frameId !== null) return

    this.frameId = window.requestAnimationFrame(() => {
      this.frameId = null
      this.renderQueued = false
      this.renderInFlight = true

      void this.renderImmediately()
        .catch((error) => this.fail(error instanceof Error ? error : new Error(String(error))))
        .finally(() => {
          this.renderInFlight = false
          if (this.renderQueued && !this.disposed) this.scheduleRender()
        })
    })
  }

  private syncSize(): void {
    if (!this.sizeDirty) return

    const rect = this.canvas.getBoundingClientRect()
    const { logicalSize, pixelSize } = resolvePreviewSurfaceSize(
      rect,
      window.devicePixelRatio,
      this.renderSize,
      this.renderLogicalSize,
    )
    this.logicalSize = logicalSize
    if (
      this.canvasSurface.size[0] !== pixelSize[0] ||
      this.canvasSurface.size[1] !== pixelSize[1]
    ) {
      this.canvasSurface.resize(pixelSize)
    }
    this.sizeDirty = false
  }

  private async renderImmediately(): Promise<void> {
    if (this.disposed) return

    this.syncSize()
    const size = this.canvasSurface.size
    const patternRepeat = getPatternRepeat(this.logicalSize, this.patternSize, [
      this.patternTexture.width,
      this.patternTexture.height,
    ])
    if (!this.meshParams || this.paramsDirty) {
      this.meshParams = toVgpuMeshParams(this.renderSpec, patternRepeat, this.patternReady)
      this.paramsKey = getStaticParamsKey(this.renderSpec)
      this.paramsDirty = false
    } else {
      this.meshParams.flow = this.renderSpec.flow
      this.meshParams.globalBrightness = Math.max(0, this.renderSpec.brightness) / 100
      this.meshParams.globalSaturation = Math.max(0, this.renderSpec.saturation) / 100
      this.meshParams.textureIntensity = this.renderSpec.hasTexture
        ? Math.min(1, Math.max(0, this.renderSpec.texture.intensity / 100))
        : 0
      this.meshParams.patternRepeat = patternRepeat
      this.meshParams.patternOpacity =
        this.renderSpec.hasPattern && this.patternReady
          ? Math.min(1, Math.max(0, this.renderSpec.patternOpacity))
          : 0
    }
    const resolution = this.meshParams.resolution as number[] | undefined
    if (resolution && resolution.length >= 2) {
      resolution[0] = size[0]
      resolution[1] = size[1]
    }
    const pixelScale = Math.max(
      size[0] / Math.max(this.logicalSize[0], 1),
      size[1] / Math.max(this.logicalSize[1], 1),
    )
    this.meshParams.blurRadius = toVgpuBlurRadius(this.renderSpec.blurIntensity) * pixelScale
    const imageSize = this.meshParams.imageSize as number[] | undefined
    if (imageSize && imageSize.length >= 2) {
      imageSize[0] = this.imageWidth
      imageSize[1] = this.imageHeight
    }
    this.meshParams.imageReady = this.imageReady ? 1 : 0
    const variantKey = getWallpaperVariantKey(this.meshParams)
    let mesh = this.meshes.get(variantKey)
    if (!mesh) {
      mesh = createWallpaperMesh(this.gpu, this.meshParams)
      this.meshes.set(variantKey, mesh)
    }
    await mesh.compile(this.postProcess.scene)
    if (this.disposed) return
    // A pattern/image can finish loading while a new variant compiles. Bind the
    // current textures after that await so the frame cannot use a retired texture.
    mesh.set({
      params: this.meshParams,
      patternSampler: this.patternSampler,
      patternTexture: this.patternTexture.texture,
      imageSampler: this.patternSampler,
      imageTexture: this.imageTexture.texture,
    })
    this.postProcess.update(size, this.meshParams)
    const currentFrame = frame(this.gpu, (gpuFrame) => {
      this.postProcess.encode(gpuFrame, this.canvasSurface, mesh)
    })
    await currentFrame.done
  }

  private fail(error: Error): void {
    if (this.disposed || this.failed) return

    this.failed = true
    this.onFailure(error)
  }

  private async syncPatternTexture(): Promise<void> {
    const imageUrl = this.renderSpec.hasPattern ? this.renderSpec.patternImage : ''
    if (
      imageUrl === this.patternTextureUrl &&
      (!imageUrl || this.patternReady || this.patternLoadingUrl === imageUrl)
    ) {
      return
    }

    const token = this.patternLoadToken + 1
    this.patternLoadToken = token
    this.patternTextureUrl = imageUrl
    this.patternLoadingUrl = imageUrl
    this.patternReady = false

    if (!imageUrl) {
      const previous = this.patternTexture
      this.patternTexture = this.patternFallback
      this.patternLoadingUrl = ''
      this.paramsDirty = true
      this.deferDestroy(previous.texture)
      this.scheduleRender()
      return
    }

    let loaded: TPatternTexture
    try {
      loaded = await loadPatternTexture(this.gpu.gpu, imageUrl)
    } catch (error) {
      if (this.disposed || token !== this.patternLoadToken) return
      this.patternTextureUrl = ''
      this.patternLoadingUrl = ''
      throw error
    }
    if (this.disposed || token !== this.patternLoadToken) {
      this.deferDestroy(loaded.texture)
      return
    }

    const previous = this.patternTexture
    this.patternTexture = loaded
    this.patternLoadingUrl = ''
    this.patternReady = true
    this.paramsDirty = true
    this.deferDestroy(previous.texture)
    this.scheduleRender()
  }

  private async syncImageTexture(): Promise<void> {
    const imageUrl = this.renderSpec.type === 'image' ? this.renderSpec.imageUrl : ''
    if (
      imageUrl === this.imageUrl &&
      (!imageUrl || this.imageReady || this.imageLoadingUrl === imageUrl)
    ) {
      return
    }

    const token = this.imageLoadToken + 1
    this.imageLoadToken = token
    this.imageUrl = imageUrl
    this.imageLoadingUrl = imageUrl
    this.imageReady = false

    if (!imageUrl) {
      const previous = this.imageTexture
      this.imageTexture = this.imageFallback
      this.imageLoadingUrl = ''
      this.imageWidth = 1
      this.imageHeight = 1
      this.deferDestroy(previous.texture)
      this.scheduleRender()
      return
    }

    const loaded = await loadPatternTexture(this.gpu.gpu, imageUrl)
    if (this.disposed || token !== this.imageLoadToken) {
      this.deferDestroy(loaded.texture)
      return
    }

    const previous = this.imageTexture
    this.imageTexture = loaded
    this.imageLoadingUrl = ''
    this.imageWidth = loaded.width
    this.imageHeight = loaded.height
    this.imageReady = true
    this.deferDestroy(previous.texture)
    this.scheduleRender()
  }

  private deferDestroy(texture: GPUTexture, includeFallback = false): void {
    if (
      !includeFallback &&
      (texture === this.patternFallback.texture || texture === this.imageFallback.texture)
    )
      return

    void this.gpu.gpu.queue
      .onSubmittedWorkDone()
      .catch(() => undefined)
      .then(() => texture.destroy())
  }
}

/** Creates and first-frame validates the production wallpaper vgpu renderer. */
export const createBgVgpuRenderer = async (
  canvas: HTMLCanvasElement,
  renderSpec: TBgRenderSpec,
  onFailure: (error: Error) => void,
  patternSize = 'auto',
  renderSize?: readonly [number, number],
  renderLogicalSize?: readonly [number, number],
): Promise<TBgVgpuRenderer> => {
  const lease = await acquireWallpaperGpu()
  let renderer: BgVgpuRenderer | undefined
  try {
    renderer = new BgVgpuRenderer(
      lease.gpu,
      lease.release,
      canvas,
      renderSpec,
      onFailure,
      patternSize,
      renderSize,
      renderLogicalSize,
    )
    await renderer.prepare()
    return renderer
  } catch (error) {
    if (renderer) renderer.destroy()
    else lease.release()
    throw error
  }
}
