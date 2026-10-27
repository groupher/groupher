import { BG_RENDER_TYPE } from '~/lib/bg'
import type { TBgRenderSpec } from '~/lib/bg'
import { GRADIENT_RENDERER, WALLPAPER_TEXTURE } from '~/lib/wallpaperMesh'

import { exportVgpuWallpaper, exportVgpuWallpaperBatch } from './export'

const mocks = vi.hoisted(() => ({
  effect: vi.fn(),
  frame: vi.fn(),
  init: vi.fn(),
  surface: vi.fn(),
  target: vi.fn(),
  pass: vi.fn(),
}))

vi.mock('vgpu', () => mocks)

const createMeshSpec = (renderer: GRADIENT_RENDERER): TBgRenderSpec => ({
  type: BG_RENDER_TYPE.MESH_GRADIENT,
  background: '#000000',
  filter: 'none',
  hasPattern: false,
  patternImage: '',
  patternOpacity: 0,
  patternColor: '#000000',
  hasTexture: false,
  source: 'test-mesh',
  colors: ['#123456', '#abcdef'],
  colorStops: [0, 100],
  flow: 42,
  texture: { type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} },
  blurIntensity: 0,
  brightness: 100,
  saturation: 100,
  gradientRecipe: null,
  meshRecipe: {
    version: 2,
    renderer,
    preset: 'test',
    seed: 7,
    colors: ['#123456', '#abcdef'],
    angle: 42,
    softness: 64,
    warp: 58,
    scale: 56,
    contrast: 108,
    brightness: 105,
  },
  imageUrl: '',
})

describe('exportVgpuWallpaper', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: {} })

    const gpu = {
      dispose: vi.fn(),
      gpu: {
        createSampler: vi.fn(() => ({ label: 'test-sampler' })),
        createTexture: vi.fn(() => ({ destroy: vi.fn(), label: 'test-texture' })),
        label: 'test-device',
        queue: {
          copyExternalImageToTexture: vi.fn(),
          writeTexture: vi.fn(),
        },
      },
      onError: vi.fn(() => vi.fn()),
      settled: vi.fn().mockResolvedValue(undefined),
    }
    const surface = {
      dispose: vi.fn(),
      format: 'rgba8unorm',
      sampleCount: 1,
    }
    const mesh = { compile: vi.fn().mockResolvedValue(undefined), set: vi.fn() }

    mocks.init.mockResolvedValue(gpu)
    mocks.surface.mockReturnValue(surface)
    mocks.target.mockReturnValue({
      size: [1, 1],
      format: 'rgba16float',
      sampleCount: 1,
      color: { destroy: vi.fn() },
      resize: vi.fn(),
    })
    mocks.effect.mockReturnValue(mesh)
    mocks.frame.mockImplementation((_gpu, callback) => {
      callback({ pass: mocks.pass })
      return { done: Promise.resolve() }
    })

    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(new Blob(['webp'], { type: 'image/webp' }))
    })
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ close: vi.fn(), height: 630, width: 1200 }),
    )
  })

  it('exports a fixed-size WebP for a supported mesh spec', async () => {
    const exported = await exportVgpuWallpaper(createMeshSpec(GRADIENT_RENDERER.LIQUID))

    expect(exported).toMatchObject({
      filename: 'wallpaper.webp',
      height: 630,
      mimeType: 'image/webp',
      width: 1200,
    })
    expect(exported.blob.type).toBe('image/webp')
    expect(exported.file.name).toBe('wallpaper.webp')
    expect(exported.file.type).toBe('image/webp')
    expect(mocks.surface).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(HTMLCanvasElement),
      expect.objectContaining({ dpr: 1, size: [1200, 630] }),
    )
  })

  it('exports a blurred wallpaper through the same GPU path', async () => {
    const exported = await exportVgpuWallpaper({
      ...createMeshSpec(GRADIENT_RENDERER.LIQUID),
      blurIntensity: 50,
    })

    expect(exported.mimeType).toBe('image/webp')
    expect(mocks.pass).toHaveBeenCalledTimes(2)
    expect(mocks.pass.mock.calls[0][0]).toBe(mocks.target.mock.results[0].value)
    expect(mocks.pass.mock.calls[1][0]).toBe(mocks.surface.mock.results[0].value)
    expect(mocks.effect.mock.results[0].value.set).toHaveBeenCalledWith(
      expect.objectContaining({
        params: { resolution: [1200, 630], blurRadius: 3, brightness: 1, saturation: 1 },
      }),
    )
  })

  it('reuses one GPU device for a multi-target batch', async () => {
    const exported = await exportVgpuWallpaperBatch([
      { renderSpec: createMeshSpec(GRADIENT_RENDERER.FLOW), targetKey: 'light-wide' },
      { renderSpec: createMeshSpec(GRADIENT_RENDERER.LIQUID), targetKey: 'light-desktop' },
    ])

    expect(exported.map(({ targetKey }) => targetKey)).toEqual(['light-wide', 'light-desktop'])
    expect(mocks.init).toHaveBeenCalledTimes(1)
    expect(mocks.surface).toHaveBeenCalledTimes(2)
  })

  it('rejects unsupported background specs before creating a GPU device', async () => {
    await expect(
      exportVgpuWallpaper({
        ...createMeshSpec(GRADIENT_RENDERER.FLOW),
        type: BG_RENDER_TYPE.IMAGE,
      }),
    ).rejects.toMatchObject({
      message: expect.stringContaining('BG_VGPU_EXPORT_UNSUPPORTED_SPEC'),
    })

    expect(mocks.init).not.toHaveBeenCalled()
  })

  it('rejects an encoded image that exceeds the configured budget', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(new Blob(['oversized'], { type: 'image/webp' }))
    })

    await expect(
      exportVgpuWallpaper(createMeshSpec(GRADIENT_RENDERER.FLOW), { maxBytes: 1 }),
    ).rejects.toMatchObject({ message: expect.stringContaining('BG_VGPU_EXPORT_TOO_LARGE') })
  })

  it('rejects an encoded image with an unexpected MIME type', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(new Blob(['not-webp'], { type: 'image/png' }))
    })

    await expect(exportVgpuWallpaper(createMeshSpec(GRADIENT_RENDERER.FLOW))).rejects.toMatchObject(
      { message: expect.stringContaining('BG_VGPU_EXPORT_INVALID_MIME') },
    )
  })
})
