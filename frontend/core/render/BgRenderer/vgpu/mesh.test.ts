import { createWallpaperMesh, getWallpaperVariantKey } from './mesh'

const mocks = vi.hoisted(() => ({ draw: vi.fn() }))
vi.mock('vgpu', () => mocks)

describe('wallpaper shader specialization', () => {
  it('keeps colors, angle, intensity and post-processing out of the pipeline key', () => {
    const params = { meshModel: 0, textureType: 1, flow: 180, textureIntensity: 0.5 }
    expect(
      getWallpaperVariantKey({
        ...params,
        color0: [1, 0, 0, 1],
        flow: 90,
        textureIntensity: 0.8,
        blurRadius: 3,
        globalBrightness: 1.5,
      }),
    ).toBe(getWallpaperVariantKey(params))
    expect(getWallpaperVariantKey({ ...params, meshModel: 2 })).not.toBe(
      getWallpaperVariantKey(params),
    )
    expect(getWallpaperVariantKey({ ...params, textureType: 9 })).not.toBe(
      getWallpaperVariantKey(params),
    )
  })

  it('uses stable numeric override IDs while keeping live controls as uniforms', () => {
    const params = { meshModel: 2, textureType: 9, flow: 42 }
    const gpu = {} as Parameters<typeof createWallpaperMesh>[0]
    createWallpaperMesh(gpu, params)
    expect(mocks.draw).toHaveBeenCalledWith(
      gpu,
      expect.objectContaining({ constants: { '0': 2, '1': 9 }, set: { params } }),
    )
  })

  it('uses the shader defaults when a pipeline variant is omitted', () => {
    const params = { flow: 42 }
    const gpu = {} as Parameters<typeof createWallpaperMesh>[0]
    createWallpaperMesh(gpu, params)
    expect(mocks.draw).toHaveBeenCalledWith(
      gpu,
      expect.objectContaining({ constants: { '0': 0, '1': 0 }, set: { params } }),
    )
    expect(getWallpaperVariantKey(params)).toBe(
      getWallpaperVariantKey({ meshModel: 0, textureType: 0 }),
    )
  })
})
