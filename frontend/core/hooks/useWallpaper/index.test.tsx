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
import useWallpaper, { resolveWallpaperCoreBgRenderSpec } from '~/hooks/useWallpaper'
import { CORE_BG_RENDER_KIND } from '~/lib/coreBg/constant'
import {
  buildGradientRecipeForRenderer,
  GRADIENT_RENDERER,
  WALLPAPER_TEXTURE,
} from '~/lib/wallpaperMesh'
import type {
  TLinearGradientRecipe,
  TMeshGradientRecipe,
  TWallpaperTexture,
} from '~/lib/wallpaperMesh'

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
      GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.ROSE_AMBER_SKY],
      GRADIENT_RENDERER.LIQUID,
    )
    const renderSpec = resolveWallpaperCoreBgRenderSpec({
      customWallpaper: null,
      source: GRADIENT_WALLPAPER_NAME.ROSE_AMBER_SKY,
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

    expect(renderSpec.kind).toBe(CORE_BG_RENDER_KIND.MESH_GRADIENT)
    expect(renderSpec.meshRecipe?.renderer).toBe(GRADIENT_RENDERER.LIQUID)
    expect(renderSpec.colors).toEqual(gradient.colors)
  })

  it('applies current gradient effects to the rendered wallpaper', () => {
    const wrapper = makeStoreWrapper({
      wallpaper: {
        source: GRADIENT_WALLPAPER_NAME.TEAL_INDIGO_MAUVE,
        type: WALLPAPER_TYPE.GRADIENT,
        gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.TEAL_INDIGO_MAUVE], angle: 90 },
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

  it('resolves small texture renderSpec separately from CSS wallpaper output', () => {
    const renderSpec = resolveWallpaperCoreBgRenderSpec({
      customWallpaper: null,
      source: GRADIENT_WALLPAPER_NAME.STONE_GREEN,
      type: WALLPAPER_TYPE.GRADIENT,
      hasPattern: false,
      patternId: DEFAULT_WALLPAPER_PATTERN_ID,
      patternIntensity: 65,
      patternTone: WALLPAPER_PATTERN_TONE.DARK,
      hasTexture: true,
      gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.STONE_GREEN], angle: 90 },
      blurIntensity: 30,
      hasShadow: false,
      brightness: 90,
      saturation: 120,
      texture: { type: WALLPAPER_TEXTURE.BEAM, intensity: 55, params: {} },
      bgSize: WALLPAPER_BG_SIZE.COVER,
    })

    expect(renderSpec.kind).toBe(CORE_BG_RENDER_KIND.LINEAR_GRADIENT)
    expect(renderSpec.patternImage).toBe('/wallpaper/pattern/01.png')
    expect(renderSpec.patternOpacity).toBe(0.65)
    expect(renderSpec.patternColor).toBe('#000000')
    expect(renderSpec.texture).toEqual({
      type: WALLPAPER_TEXTURE.BEAM,
      intensity: 55,
      params: {},
    })
    expect(renderSpec.background).not.toContain('data:image')
  })

  it('keeps gradient pattern out of the renderer fallback background', () => {
    const renderSpec = resolveWallpaperCoreBgRenderSpec({
      customWallpaper: null,
      source: GRADIENT_WALLPAPER_NAME.STONE_GREEN,
      type: WALLPAPER_TYPE.GRADIENT,
      hasPattern: true,
      patternId: DEFAULT_WALLPAPER_PATTERN_ID,
      patternIntensity: 10,
      patternTone: WALLPAPER_PATTERN_TONE.DARK,
      hasTexture: false,
      gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.STONE_GREEN], angle: 90 },
      blurIntensity: 0,
      hasShadow: false,
      brightness: 100,
      saturation: 100,
      texture: { type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} },
      bgSize: WALLPAPER_BG_SIZE.COVER,
    })

    expect(renderSpec.hasPattern).toBe(true)
    expect(renderSpec.patternOpacity).toBe(0.1)
    expect(renderSpec.background).toContain('linear-gradient(90deg')
    expect(renderSpec.background).not.toContain('/wallpaper/pattern/')
  })

  it('normalizes linear gradient spread as a centered transition band', () => {
    const renderSpec = resolveWallpaperCoreBgRenderSpec({
      customWallpaper: null,
      source: GRADIENT_WALLPAPER_NAME.STONE_GREEN,
      type: WALLPAPER_TYPE.GRADIENT,
      hasPattern: false,
      patternId: DEFAULT_WALLPAPER_PATTERN_ID,
      patternIntensity: 100,
      patternTone: WALLPAPER_PATTERN_TONE.DARK,
      hasTexture: false,
      gradient: {
        ...(GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.STONE_GREEN] as TLinearGradientRecipe),
        spread: 0,
      },
      blurIntensity: 0,
      hasShadow: false,
      brightness: 100,
      saturation: 100,
      texture: { type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} },
      bgSize: WALLPAPER_BG_SIZE.COVER,
    })

    expect(renderSpec.kind).toBe(CORE_BG_RENDER_KIND.LINEAR_GRADIENT)
    expect(renderSpec.colorStops).toEqual([46, 54])
  })

  it('normalizes radial gradient spread as outward palette reach', () => {
    const radialGradient = buildGradientRecipeForRenderer(
      GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.SKY_MAUVE_BLUE],
      GRADIENT_RENDERER.RADIAL,
    )
    if (radialGradient.renderer !== GRADIENT_RENDERER.RADIAL) throw new Error('expected radial')

    const renderSpec = resolveWallpaperCoreBgRenderSpec({
      customWallpaper: null,
      source: GRADIENT_WALLPAPER_NAME.SKY_MAUVE_BLUE,
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

    expect(renderSpec.kind).toBe(CORE_BG_RENDER_KIND.RADIAL_GRADIENT)
    expect(renderSpec.colorStops).toEqual([0, 20, 39, 59])
    expect(renderSpec.background).toContain('radial-gradient')
    expect(renderSpec.background).not.toContain('transparent')
  })

  it('uses explicit radial gradient stops in the renderer render spec', () => {
    const radialGradient = buildGradientRecipeForRenderer(
      GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.SKY_MAUVE_BLUE],
      GRADIENT_RENDERER.RADIAL,
    )
    if (radialGradient.renderer !== GRADIENT_RENDERER.RADIAL) throw new Error('expected radial')

    const renderSpec = resolveWallpaperCoreBgRenderSpec({
      customWallpaper: null,
      source: GRADIENT_WALLPAPER_NAME.SKY_MAUVE_BLUE,
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

    expect(renderSpec.kind).toBe(CORE_BG_RENDER_KIND.RADIAL_GRADIENT)
    expect(renderSpec.colorStops).toEqual([0, 20, 70, 100])
  })

  it('falls back unsupported texture payloads to noise', () => {
    const renderSpec = resolveWallpaperCoreBgRenderSpec({
      customWallpaper: null,
      source: GRADIENT_WALLPAPER_NAME.STONE_GREEN,
      type: WALLPAPER_TYPE.GRADIENT,
      hasPattern: false,
      patternId: DEFAULT_WALLPAPER_PATTERN_ID,
      patternIntensity: 100,
      patternTone: WALLPAPER_PATTERN_TONE.DARK,
      hasTexture: true,
      gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.STONE_GREEN], angle: 90 },
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

    expect(renderSpec.texture).toEqual({
      type: WALLPAPER_TEXTURE.NOISE,
      intensity: 65,
      params: {},
    })
  })

  it('accepts dots texture renderSpecs', () => {
    const renderSpec = resolveWallpaperCoreBgRenderSpec({
      customWallpaper: null,
      source: GRADIENT_WALLPAPER_NAME.STONE_GREEN,
      type: WALLPAPER_TYPE.GRADIENT,
      hasPattern: false,
      patternId: DEFAULT_WALLPAPER_PATTERN_ID,
      patternIntensity: 100,
      patternTone: WALLPAPER_PATTERN_TONE.DARK,
      hasTexture: true,
      gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.STONE_GREEN], angle: 90 },
      blurIntensity: 0,
      hasShadow: false,
      brightness: 100,
      saturation: 100,
      texture: { type: WALLPAPER_TEXTURE.DOTS, intensity: 70, params: {} },
      bgSize: WALLPAPER_BG_SIZE.COVER,
    })

    expect(renderSpec.texture).toEqual({
      type: WALLPAPER_TEXTURE.DOTS,
      intensity: 70,
      params: {},
    })
  })

  it('accepts oil texture renderSpecs', () => {
    const renderSpec = resolveWallpaperCoreBgRenderSpec({
      customWallpaper: null,
      source: GRADIENT_WALLPAPER_NAME.STONE_GREEN,
      type: WALLPAPER_TYPE.GRADIENT,
      hasPattern: false,
      patternId: DEFAULT_WALLPAPER_PATTERN_ID,
      patternIntensity: 100,
      patternTone: WALLPAPER_PATTERN_TONE.DARK,
      hasTexture: true,
      gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.STONE_GREEN], angle: 90 },
      blurIntensity: 0,
      hasShadow: false,
      brightness: 100,
      saturation: 100,
      texture: { type: WALLPAPER_TEXTURE.OIL, intensity: 70, params: {} },
      bgSize: WALLPAPER_BG_SIZE.COVER,
    })

    expect(renderSpec.texture).toEqual({
      type: WALLPAPER_TEXTURE.OIL,
      intensity: 70,
      params: {},
    })
  })

  it('accepts tile texture renderSpecs', () => {
    const renderSpec = resolveWallpaperCoreBgRenderSpec({
      customWallpaper: null,
      source: GRADIENT_WALLPAPER_NAME.STONE_GREEN,
      type: WALLPAPER_TYPE.GRADIENT,
      hasPattern: false,
      patternId: DEFAULT_WALLPAPER_PATTERN_ID,
      patternIntensity: 100,
      patternTone: WALLPAPER_PATTERN_TONE.DARK,
      hasTexture: true,
      gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.STONE_GREEN], angle: 90 },
      blurIntensity: 0,
      hasShadow: false,
      brightness: 100,
      saturation: 100,
      texture: { type: WALLPAPER_TEXTURE.TILE, intensity: 70, params: {} },
      bgSize: WALLPAPER_BG_SIZE.COVER,
    })

    expect(renderSpec.texture).toEqual({
      type: WALLPAPER_TEXTURE.TILE,
      intensity: 70,
      params: {},
    })
  })

  it('keeps texture settings while marking them disabled', () => {
    const renderSpec = resolveWallpaperCoreBgRenderSpec({
      customWallpaper: null,
      source: GRADIENT_WALLPAPER_NAME.STONE_GREEN,
      type: WALLPAPER_TYPE.GRADIENT,
      hasPattern: false,
      patternId: DEFAULT_WALLPAPER_PATTERN_ID,
      patternIntensity: 100,
      patternTone: WALLPAPER_PATTERN_TONE.DARK,
      hasTexture: false,
      gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.STONE_GREEN], angle: 90 },
      blurIntensity: 0,
      hasShadow: false,
      brightness: 100,
      saturation: 100,
      texture: { type: WALLPAPER_TEXTURE.TILE, intensity: 70, params: {} },
      bgSize: WALLPAPER_BG_SIZE.COVER,
    })

    expect(renderSpec.hasTexture).toBe(false)
    expect(renderSpec.texture).toEqual({
      type: WALLPAPER_TEXTURE.TILE,
      intensity: 70,
      params: {},
    })
  })

  it('uses a light pattern color when pattern tone is light', () => {
    const renderSpec = resolveWallpaperCoreBgRenderSpec({
      customWallpaper: null,
      source: GRADIENT_WALLPAPER_NAME.VIOLET_TEAL_AMBER,
      type: WALLPAPER_TYPE.GRADIENT,
      hasPattern: true,
      patternId: DEFAULT_WALLPAPER_PATTERN_ID,
      patternIntensity: 100,
      patternTone: WALLPAPER_PATTERN_TONE.LIGHT,
      hasTexture: false,
      gradient: GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.VIOLET_TEAL_AMBER],
      blurIntensity: 0,
      hasShadow: false,
      brightness: 100,
      saturation: 100,
      texture: { type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} },
      bgSize: WALLPAPER_BG_SIZE.COVER,
    })

    expect(renderSpec.patternColor).toBe('#ffffff')
  })

  it('resolves mesh gradient texture renderSpec', () => {
    const renderSpec = resolveWallpaperCoreBgRenderSpec({
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

    expect(renderSpec.kind).toBe(CORE_BG_RENDER_KIND.MESH_GRADIENT)
    expect(renderSpec.hasTexture).toBe(true)
    expect(renderSpec.texture).toEqual({
      type: WALLPAPER_TEXTURE.ASCII,
      intensity: 80,
      params: {},
    })
    expect(renderSpec.flow).toBe(135)
    expect(renderSpec.meshRecipe?.renderer).toBe(GRADIENT_RENDERER.FLOW)
  })
})
