import { renderHook } from '@testing-library/react'

import { GRADIENT_WALLPAPER, GRADIENT_WALLPAPER_NAME, WALLPAPER_TYPE } from '~/const/wallpaper'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useWallpaper, { resolveWallpaperRenderDescriptor } from '~/hooks/useWallpaper'
import { GRADIENT_TYPE, WALLPAPER_TEXTURE } from '~/lib/wallpaperMesh'
import type { TMeshGradientRecipe, TWallpaperTexture } from '~/lib/wallpaperMesh'

describe('useWallpaper', () => {
  const mesh: TMeshGradientRecipe = {
    version: 1,
    kind: GRADIENT_TYPE.MESH,
    preset: 'test',
    seed: 1,
    colors: ['#fbeede', '#ff7f6f', '#5f74a6'],
    flow: 135,
    softness: 60,
    contrast: 100,
    brightness: 100,
    anchors: [
      { x: 0.2, y: 0.2, color: 0 },
      { x: 0.78, y: 0.82, color: 2 },
    ],
  }

  it('parses mesh wallpaper', () => {
    const wrapper = makeStoreWrapper({
      wallpaper: {
        source: mesh.preset,
        type: WALLPAPER_TYPE.GRADIENT,
        gradient: mesh,
        hasPattern: false,
        blurIntensity: 50,
        hasShadow: true,
      },
    })

    const { result } = renderHook(() => useWallpaper(), { wrapper })

    expect(result.current.source).toBe(mesh.preset)
    expect(result.current.hasShadow).toBe(true)
    expect(result.current.background).toContain('linear-gradient(135deg')
    expect(result.current.effect).toContain('blur')
  })

  it('applies current gradient effects to the rendered wallpaper', () => {
    const wrapper = makeStoreWrapper({
      wallpaper: {
        source: GRADIENT_WALLPAPER_NAME.PURPLE,
        type: WALLPAPER_TYPE.GRADIENT,
        gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.PURPLE], angle: 90 },
        hasPattern: true,
        blurIntensity: 50,
      },
    })

    const { result } = renderHook(() => useWallpaper(), { wrapper })

    expect(result.current.background).toContain('url(/wallpaper/pattern/1.png)')
    expect(result.current.background).toContain('linear-gradient(90deg')
    expect(result.current.effect).toContain('blur')
  })

  it('renders selected picture wallpaper with the full image', () => {
    const wrapper = makeStoreWrapper({
      wallpaper: {
        source: 'backiee-1',
        type: WALLPAPER_TYPE.PATTERN,
        blurIntensity: 50,
        brightness: 85,
        saturation: 120,
      },
    })

    const { result } = renderHook(() => useWallpaper(), { wrapper })

    expect(result.current.background).toBe(
      'url(/wallpaper/picture/backiee-1.webp) center / cover no-repeat',
    )
    expect(result.current.background).not.toContain('picture-preview')
    expect(result.current.effect).toContain('blur')
    expect(result.current.effect).toContain('brightness(85%)')
    expect(result.current.effect).toContain('saturate(120%)')
  })

  it('keeps default picture adjustment values out of the filter', () => {
    const wrapper = makeStoreWrapper({
      wallpaper: {
        source: 'backiee-1',
        type: WALLPAPER_TYPE.PATTERN,
        brightness: 100,
        saturation: 100,
      },
    })

    const { result } = renderHook(() => useWallpaper(), { wrapper })

    expect(result.current.background).toContain('center / cover no-repeat')
    expect(result.current.effect).not.toContain('!important')
    expect(result.current.effect).not.toContain('brightness')
    expect(result.current.effect).not.toContain('saturate')
  })

  it('uses cover for picture wallpaper even when hidden bgSize state differs', () => {
    const wrapper = makeStoreWrapper({
      wallpaper: {
        source: 'backiee-1',
        type: WALLPAPER_TYPE.PATTERN,
        bgSize: 'contain',
      },
    })

    const { result } = renderHook(() => useWallpaper(), { wrapper })

    expect(result.current.background).toContain('center / cover no-repeat')
  })

  it('resolves small texture descriptor separately from CSS wallpaper output', () => {
    const descriptor = resolveWallpaperRenderDescriptor({
      customWallpaper: null,
      source: GRADIENT_WALLPAPER_NAME.GREEN,
      type: WALLPAPER_TYPE.GRADIENT,
      hasPattern: true,
      hasTexture: true,
      gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.GREEN], angle: 90 },
      blurIntensity: 30,
      hasShadow: false,
      brightness: 90,
      saturation: 120,
      texture: { type: WALLPAPER_TEXTURE.BEAM, intensity: 55, params: {} },
      bgSize: 'cover',
    })

    expect(descriptor.kind).toBe('linear-gradient')
    expect(descriptor.texture).toEqual({
      type: WALLPAPER_TEXTURE.BEAM,
      intensity: 55,
      params: {},
    })
    expect(descriptor.background).not.toContain('data:image')
  })

  it('normalizes linear gradient spread as a centered transition band', () => {
    const descriptor = resolveWallpaperRenderDescriptor({
      customWallpaper: null,
      source: GRADIENT_WALLPAPER_NAME.GREEN,
      type: WALLPAPER_TYPE.GRADIENT,
      hasPattern: false,
      hasTexture: false,
      gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.GREEN], spread: 0 },
      blurIntensity: 0,
      hasShadow: false,
      brightness: 100,
      saturation: 100,
      texture: { type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} },
      bgSize: 'cover',
    })

    expect(descriptor.kind).toBe('linear-gradient')
    expect(descriptor.colorStops).toEqual([46, 54])
  })

  it('normalizes radial gradient spread as outward palette reach', () => {
    const descriptor = resolveWallpaperRenderDescriptor({
      customWallpaper: null,
      source: GRADIENT_WALLPAPER_NAME.BLUE,
      type: WALLPAPER_TYPE.GRADIENT,
      hasPattern: false,
      hasTexture: false,
      gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.BLUE], spread: 50 },
      blurIntensity: 0,
      hasShadow: false,
      brightness: 100,
      saturation: 100,
      texture: { type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} },
      bgSize: 'cover',
    })

    expect(descriptor.kind).toBe('radial-gradient')
    expect(descriptor.colorStops).toEqual([0, 20, 39, 59])
    expect(descriptor.background).toContain('radial-gradient')
    expect(descriptor.background).not.toContain('transparent')
  })

  it('uses explicit radial gradient stops in the renderer descriptor', () => {
    const descriptor = resolveWallpaperRenderDescriptor({
      customWallpaper: null,
      source: GRADIENT_WALLPAPER_NAME.BLUE,
      type: WALLPAPER_TYPE.GRADIENT,
      hasPattern: false,
      hasTexture: false,
      gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.BLUE], stops: [0, 20, 70, 100] },
      blurIntensity: 0,
      hasShadow: false,
      brightness: 100,
      saturation: 100,
      texture: { type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} },
      bgSize: 'cover',
    })

    expect(descriptor.kind).toBe('radial-gradient')
    expect(descriptor.colorStops).toEqual([0, 20, 70, 100])
  })

  it('falls back unsupported texture payloads to noise', () => {
    const descriptor = resolveWallpaperRenderDescriptor({
      customWallpaper: null,
      source: GRADIENT_WALLPAPER_NAME.GREEN,
      type: WALLPAPER_TYPE.GRADIENT,
      hasPattern: false,
      hasTexture: true,
      gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.GREEN], angle: 90 },
      blurIntensity: 0,
      hasShadow: false,
      brightness: 100,
      saturation: 100,
      texture: {
        type: 'unsupported-texture',
        intensity: 65,
        params: {},
      } as unknown as TWallpaperTexture,
      bgSize: 'cover',
    })

    expect(descriptor.texture).toEqual({
      type: WALLPAPER_TEXTURE.NOISE,
      intensity: 65,
      params: {},
    })
  })

  it('accepts dots texture descriptors', () => {
    const descriptor = resolveWallpaperRenderDescriptor({
      customWallpaper: null,
      source: GRADIENT_WALLPAPER_NAME.GREEN,
      type: WALLPAPER_TYPE.GRADIENT,
      hasPattern: false,
      hasTexture: true,
      gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.GREEN], angle: 90 },
      blurIntensity: 0,
      hasShadow: false,
      brightness: 100,
      saturation: 100,
      texture: { type: WALLPAPER_TEXTURE.DOTS, intensity: 70, params: {} },
      bgSize: 'cover',
    })

    expect(descriptor.texture).toEqual({
      type: WALLPAPER_TEXTURE.DOTS,
      intensity: 70,
      params: {},
    })
  })

  it('normalizes removed texture aliases to supported textures', () => {
    const mosaicDescriptor = resolveWallpaperRenderDescriptor({
      customWallpaper: null,
      source: GRADIENT_WALLPAPER_NAME.GREEN,
      type: WALLPAPER_TYPE.GRADIENT,
      hasPattern: false,
      hasTexture: true,
      gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.GREEN], angle: 90 },
      blurIntensity: 0,
      hasShadow: false,
      brightness: 100,
      saturation: 100,
      texture: { type: 'mosaic', intensity: 35, params: {} } as unknown as TWallpaperTexture,
      bgSize: 'cover',
    })
    const halftoneDescriptor = resolveWallpaperRenderDescriptor({
      customWallpaper: null,
      source: GRADIENT_WALLPAPER_NAME.GREEN,
      type: WALLPAPER_TYPE.GRADIENT,
      hasPattern: false,
      hasTexture: true,
      gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.GREEN], angle: 90 },
      blurIntensity: 0,
      hasShadow: false,
      brightness: 100,
      saturation: 100,
      texture: { type: 'halftone', intensity: 35, params: {} } as unknown as TWallpaperTexture,
      bgSize: 'cover',
    })

    expect(mosaicDescriptor.texture.type).toBe(WALLPAPER_TEXTURE.TILE)
    expect(halftoneDescriptor.texture.type).toBe(WALLPAPER_TEXTURE.DOTS)
  })

  it('accepts tile texture descriptors', () => {
    const descriptor = resolveWallpaperRenderDescriptor({
      customWallpaper: null,
      source: GRADIENT_WALLPAPER_NAME.GREEN,
      type: WALLPAPER_TYPE.GRADIENT,
      hasPattern: false,
      hasTexture: true,
      gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.GREEN], angle: 90 },
      blurIntensity: 0,
      hasShadow: false,
      brightness: 100,
      saturation: 100,
      texture: { type: WALLPAPER_TEXTURE.TILE, intensity: 70, params: {} },
      bgSize: 'cover',
    })

    expect(descriptor.texture).toEqual({
      type: WALLPAPER_TEXTURE.TILE,
      intensity: 70,
      params: {},
    })
  })

  it('keeps texture settings while marking them disabled', () => {
    const descriptor = resolveWallpaperRenderDescriptor({
      customWallpaper: null,
      source: GRADIENT_WALLPAPER_NAME.GREEN,
      type: WALLPAPER_TYPE.GRADIENT,
      hasPattern: false,
      hasTexture: false,
      gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.GREEN], angle: 90 },
      blurIntensity: 0,
      hasShadow: false,
      brightness: 100,
      saturation: 100,
      texture: { type: WALLPAPER_TEXTURE.TILE, intensity: 70, params: {} },
      bgSize: 'cover',
    })

    expect(descriptor.hasTexture).toBe(false)
    expect(descriptor.texture).toEqual({
      type: WALLPAPER_TEXTURE.TILE,
      intensity: 70,
      params: {},
    })
  })

  it('resolves mesh gradient texture descriptor', () => {
    const descriptor = resolveWallpaperRenderDescriptor({
      customWallpaper: null,
      source: mesh.preset,
      type: WALLPAPER_TYPE.GRADIENT,
      hasPattern: false,
      hasTexture: true,
      gradient: mesh,
      blurIntensity: 0,
      hasShadow: false,
      brightness: 100,
      saturation: 100,
      texture: { type: WALLPAPER_TEXTURE.ASCII, intensity: 80, params: {} },
      bgSize: 'cover',
    })

    expect(descriptor.kind).toBe('mesh-gradient')
    expect(descriptor.texture).toEqual({
      type: WALLPAPER_TEXTURE.ASCII,
      intensity: 80,
      params: {},
    })
    expect(descriptor.flow).toBe(135)
    expect(descriptor.meshRecipe?.anchors).toHaveLength(2)
  })
})
