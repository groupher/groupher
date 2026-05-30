import { renderHook } from '@testing-library/react'

import {
  DEFAULT_WALLPAPER_PATTERN_ID,
  GRADIENT_WALLPAPER,
  GRADIENT_WALLPAPER_NAME,
  WALLPAPER_BG_SIZE,
  WALLPAPER_PATTERN_TONE,
  WALLPAPER_TYPE,
} from '~/const/wallpaper'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useWallpaper, { resolveWallpaperRenderDescriptor } from '~/hooks/useWallpaper'
import {
  buildGradientRecipeForRenderer,
  GRADIENT_RENDERER,
  WALLPAPER_TEXTURE,
} from '~/lib/wallpaperMesh'
import type { TMeshGradientRecipe, TWallpaperTexture } from '~/lib/wallpaperMesh'
import { WALLPAPER_RENDER_KIND } from '~/lib/wallpaperRenderer/constant'

describe('useWallpaper', () => {
  const mesh: TMeshGradientRecipe = {
    version: 2,
    renderer: GRADIENT_RENDERER.FLOW,
    preset: 'test',
    seed: 1,
    colors: ['#fbeede', '#ff7f6f', '#5f74a6'],
    angle: 135,
    softness: 60,
    warp: 50,
    scale: 60,
    contrast: 100,
    brightness: 100,
  }

  it('parses mesh wallpaper', () => {
    const wrapper = makeStoreWrapper({
      wallpaper: {
        source: mesh.preset,
        type: WALLPAPER_TYPE.GRADIENT,
        gradient: mesh,
        hasPattern: false,
        patternId: DEFAULT_WALLPAPER_PATTERN_ID,
        patternIntensity: 100,
        patternTone: WALLPAPER_PATTERN_TONE.DARK,
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

  it('resolves lagoon as liquid wallpaper', () => {
    const gradient = buildGradientRecipeForRenderer(
      GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.LAGOON],
      GRADIENT_RENDERER.LIQUID,
    )
    const descriptor = resolveWallpaperRenderDescriptor({
      customWallpaper: null,
      source: GRADIENT_WALLPAPER_NAME.LAGOON,
      type: WALLPAPER_TYPE.GRADIENT,
      hasPattern: false,
      patternId: DEFAULT_WALLPAPER_PATTERN_ID,
      patternIntensity: 100,
      patternTone: WALLPAPER_PATTERN_TONE.DARK,
      hasTexture: false,
      gradient,
      blurIntensity: 0,
      hasShadow: false,
      brightness: 100,
      saturation: 100,
      texture: { type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} },
      bgSize: WALLPAPER_BG_SIZE.COVER,
    })

    expect(descriptor.kind).toBe(WALLPAPER_RENDER_KIND.MESH_GRADIENT)
    expect(descriptor.meshRecipe?.renderer).toBe(GRADIENT_RENDERER.LIQUID)
    expect(descriptor.colors).toEqual(gradient.colors)
  })

  it('applies current gradient effects to the rendered wallpaper', () => {
    const wrapper = makeStoreWrapper({
      wallpaper: {
        source: GRADIENT_WALLPAPER_NAME.PURPLE,
        type: WALLPAPER_TYPE.GRADIENT,
        gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.PURPLE], angle: 90 },
        hasPattern: true,
        patternId: DEFAULT_WALLPAPER_PATTERN_ID,
        patternIntensity: 100,
        patternTone: WALLPAPER_PATTERN_TONE.DARK,
        blurIntensity: 50,
      },
    })

    const { result } = renderHook(() => useWallpaper(), { wrapper })

    expect(result.current.background).toContain('url(/wallpaper/pattern/01.png)')
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
        bgSize: WALLPAPER_BG_SIZE.CONTAIN,
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
      hasPattern: false,
      patternId: DEFAULT_WALLPAPER_PATTERN_ID,
      patternIntensity: 65,
      patternTone: WALLPAPER_PATTERN_TONE.DARK,
      hasTexture: true,
      gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.GREEN], angle: 90 },
      blurIntensity: 30,
      hasShadow: false,
      brightness: 90,
      saturation: 120,
      texture: { type: WALLPAPER_TEXTURE.BEAM, intensity: 55, params: {} },
      bgSize: WALLPAPER_BG_SIZE.COVER,
    })

    expect(descriptor.kind).toBe(WALLPAPER_RENDER_KIND.LINEAR_GRADIENT)
    expect(descriptor.patternImage).toBe('/wallpaper/pattern/01.png')
    expect(descriptor.patternOpacity).toBe(0.65)
    expect(descriptor.patternColor).toBe('#000000')
    expect(descriptor.texture).toEqual({
      type: WALLPAPER_TEXTURE.BEAM,
      intensity: 55,
      params: {},
    })
    expect(descriptor.background).not.toContain('data:image')
  })

  it('keeps gradient pattern out of the renderer fallback background', () => {
    const descriptor = resolveWallpaperRenderDescriptor({
      customWallpaper: null,
      source: GRADIENT_WALLPAPER_NAME.GREEN,
      type: WALLPAPER_TYPE.GRADIENT,
      hasPattern: true,
      patternId: DEFAULT_WALLPAPER_PATTERN_ID,
      patternIntensity: 10,
      patternTone: WALLPAPER_PATTERN_TONE.DARK,
      hasTexture: false,
      gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.GREEN], angle: 90 },
      blurIntensity: 0,
      hasShadow: false,
      brightness: 100,
      saturation: 100,
      texture: { type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} },
      bgSize: WALLPAPER_BG_SIZE.COVER,
    })

    expect(descriptor.hasPattern).toBe(true)
    expect(descriptor.patternOpacity).toBe(0.1)
    expect(descriptor.background).toContain('linear-gradient(90deg')
    expect(descriptor.background).not.toContain('/wallpaper/pattern/')
  })

  it('normalizes linear gradient spread as a centered transition band', () => {
    const descriptor = resolveWallpaperRenderDescriptor({
      customWallpaper: null,
      source: GRADIENT_WALLPAPER_NAME.GREEN,
      type: WALLPAPER_TYPE.GRADIENT,
      hasPattern: false,
      patternId: DEFAULT_WALLPAPER_PATTERN_ID,
      patternIntensity: 100,
      patternTone: WALLPAPER_PATTERN_TONE.DARK,
      hasTexture: false,
      gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.GREEN], spread: 0 },
      blurIntensity: 0,
      hasShadow: false,
      brightness: 100,
      saturation: 100,
      texture: { type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} },
      bgSize: WALLPAPER_BG_SIZE.COVER,
    })

    expect(descriptor.kind).toBe(WALLPAPER_RENDER_KIND.LINEAR_GRADIENT)
    expect(descriptor.colorStops).toEqual([46, 54])
  })

  it('normalizes radial gradient spread as outward palette reach', () => {
    const radialGradient = buildGradientRecipeForRenderer(
      GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.BLUE],
      GRADIENT_RENDERER.RADIAL,
    )
    if (radialGradient.renderer !== GRADIENT_RENDERER.RADIAL) throw new Error('expected radial')

    const descriptor = resolveWallpaperRenderDescriptor({
      customWallpaper: null,
      source: GRADIENT_WALLPAPER_NAME.BLUE,
      type: WALLPAPER_TYPE.GRADIENT,
      hasPattern: false,
      patternId: DEFAULT_WALLPAPER_PATTERN_ID,
      patternIntensity: 100,
      patternTone: WALLPAPER_PATTERN_TONE.DARK,
      hasTexture: false,
      gradient: { ...radialGradient, spread: 50 },
      blurIntensity: 0,
      hasShadow: false,
      brightness: 100,
      saturation: 100,
      texture: { type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} },
      bgSize: WALLPAPER_BG_SIZE.COVER,
    })

    expect(descriptor.kind).toBe(WALLPAPER_RENDER_KIND.RADIAL_GRADIENT)
    expect(descriptor.colorStops).toEqual([0, 20, 39, 59])
    expect(descriptor.background).toContain('radial-gradient')
    expect(descriptor.background).not.toContain('transparent')
  })

  it('uses explicit radial gradient stops in the renderer descriptor', () => {
    const radialGradient = buildGradientRecipeForRenderer(
      GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.BLUE],
      GRADIENT_RENDERER.RADIAL,
    )
    if (radialGradient.renderer !== GRADIENT_RENDERER.RADIAL) throw new Error('expected radial')

    const descriptor = resolveWallpaperRenderDescriptor({
      customWallpaper: null,
      source: GRADIENT_WALLPAPER_NAME.BLUE,
      type: WALLPAPER_TYPE.GRADIENT,
      hasPattern: false,
      patternId: DEFAULT_WALLPAPER_PATTERN_ID,
      patternIntensity: 100,
      patternTone: WALLPAPER_PATTERN_TONE.DARK,
      hasTexture: false,
      gradient: { ...radialGradient, stops: [0, 20, 70, 100] },
      blurIntensity: 0,
      hasShadow: false,
      brightness: 100,
      saturation: 100,
      texture: { type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} },
      bgSize: WALLPAPER_BG_SIZE.COVER,
    })

    expect(descriptor.kind).toBe(WALLPAPER_RENDER_KIND.RADIAL_GRADIENT)
    expect(descriptor.colorStops).toEqual([0, 20, 70, 100])
  })

  it('falls back unsupported texture payloads to noise', () => {
    const descriptor = resolveWallpaperRenderDescriptor({
      customWallpaper: null,
      source: GRADIENT_WALLPAPER_NAME.GREEN,
      type: WALLPAPER_TYPE.GRADIENT,
      hasPattern: false,
      patternId: DEFAULT_WALLPAPER_PATTERN_ID,
      patternIntensity: 100,
      patternTone: WALLPAPER_PATTERN_TONE.DARK,
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
      bgSize: WALLPAPER_BG_SIZE.COVER,
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
      patternId: DEFAULT_WALLPAPER_PATTERN_ID,
      patternIntensity: 100,
      patternTone: WALLPAPER_PATTERN_TONE.DARK,
      hasTexture: true,
      gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.GREEN], angle: 90 },
      blurIntensity: 0,
      hasShadow: false,
      brightness: 100,
      saturation: 100,
      texture: { type: WALLPAPER_TEXTURE.DOTS, intensity: 70, params: {} },
      bgSize: WALLPAPER_BG_SIZE.COVER,
    })

    expect(descriptor.texture).toEqual({
      type: WALLPAPER_TEXTURE.DOTS,
      intensity: 70,
      params: {},
    })
  })

  it('accepts oil texture descriptors', () => {
    const descriptor = resolveWallpaperRenderDescriptor({
      customWallpaper: null,
      source: GRADIENT_WALLPAPER_NAME.GREEN,
      type: WALLPAPER_TYPE.GRADIENT,
      hasPattern: false,
      patternId: DEFAULT_WALLPAPER_PATTERN_ID,
      patternIntensity: 100,
      patternTone: WALLPAPER_PATTERN_TONE.DARK,
      hasTexture: true,
      gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.GREEN], angle: 90 },
      blurIntensity: 0,
      hasShadow: false,
      brightness: 100,
      saturation: 100,
      texture: { type: WALLPAPER_TEXTURE.OIL, intensity: 70, params: {} },
      bgSize: WALLPAPER_BG_SIZE.COVER,
    })

    expect(descriptor.texture).toEqual({
      type: WALLPAPER_TEXTURE.OIL,
      intensity: 70,
      params: {},
    })
  })

  it('accepts tile texture descriptors', () => {
    const descriptor = resolveWallpaperRenderDescriptor({
      customWallpaper: null,
      source: GRADIENT_WALLPAPER_NAME.GREEN,
      type: WALLPAPER_TYPE.GRADIENT,
      hasPattern: false,
      patternId: DEFAULT_WALLPAPER_PATTERN_ID,
      patternIntensity: 100,
      patternTone: WALLPAPER_PATTERN_TONE.DARK,
      hasTexture: true,
      gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.GREEN], angle: 90 },
      blurIntensity: 0,
      hasShadow: false,
      brightness: 100,
      saturation: 100,
      texture: { type: WALLPAPER_TEXTURE.TILE, intensity: 70, params: {} },
      bgSize: WALLPAPER_BG_SIZE.COVER,
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
      patternId: DEFAULT_WALLPAPER_PATTERN_ID,
      patternIntensity: 100,
      patternTone: WALLPAPER_PATTERN_TONE.DARK,
      hasTexture: false,
      gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.GREEN], angle: 90 },
      blurIntensity: 0,
      hasShadow: false,
      brightness: 100,
      saturation: 100,
      texture: { type: WALLPAPER_TEXTURE.TILE, intensity: 70, params: {} },
      bgSize: WALLPAPER_BG_SIZE.COVER,
    })

    expect(descriptor.hasTexture).toBe(false)
    expect(descriptor.texture).toEqual({
      type: WALLPAPER_TEXTURE.TILE,
      intensity: 70,
      params: {},
    })
  })

  it('uses a light pattern color when pattern tone is light', () => {
    const descriptor = resolveWallpaperRenderDescriptor({
      customWallpaper: null,
      source: GRADIENT_WALLPAPER_NAME.AURORA,
      type: WALLPAPER_TYPE.GRADIENT,
      hasPattern: true,
      patternId: DEFAULT_WALLPAPER_PATTERN_ID,
      patternIntensity: 100,
      patternTone: WALLPAPER_PATTERN_TONE.LIGHT,
      hasTexture: false,
      gradient: GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.AURORA],
      blurIntensity: 0,
      hasShadow: false,
      brightness: 100,
      saturation: 100,
      texture: { type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} },
      bgSize: WALLPAPER_BG_SIZE.COVER,
    })

    expect(descriptor.patternColor).toBe('#ffffff')
  })

  it('resolves mesh gradient texture descriptor', () => {
    const descriptor = resolveWallpaperRenderDescriptor({
      customWallpaper: null,
      source: mesh.preset,
      type: WALLPAPER_TYPE.GRADIENT,
      hasPattern: false,
      patternId: DEFAULT_WALLPAPER_PATTERN_ID,
      patternIntensity: 100,
      patternTone: WALLPAPER_PATTERN_TONE.DARK,
      hasTexture: true,
      gradient: mesh,
      blurIntensity: 0,
      hasShadow: false,
      brightness: 100,
      saturation: 100,
      texture: { type: WALLPAPER_TEXTURE.ASCII, intensity: 80, params: {} },
      bgSize: WALLPAPER_BG_SIZE.COVER,
    })

    expect(descriptor.kind).toBe(WALLPAPER_RENDER_KIND.MESH_GRADIENT)
    expect(descriptor.hasTexture).toBe(true)
    expect(descriptor.texture).toEqual({
      type: WALLPAPER_TEXTURE.ASCII,
      intensity: 80,
      params: {},
    })
    expect(descriptor.flow).toBe(135)
    expect(descriptor.meshRecipe?.renderer).toBe(GRADIENT_RENDERER.FLOW)
  })
})
