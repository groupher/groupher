import { renderHook } from '@testing-library/react'

import {
  DEFAULT_WALLPAPER_PATTERN_ID,
  GRADIENT_WALLPAPER,
  GRADIENT_WALLPAPER_NAME,
  WALLPAPER_PATTERN_TONE,
  WALLPAPER_TYPE,
} from '~/const/wallpaper'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useWallpaper, { adaptWallpaperBgRenderSpec } from '~/hooks/useWallpaper'
import { BG_RENDER_TYPE } from '~/lib/bg'
import { composeBgRenderSpec } from '~/lib/bg'
import {
  composeGradientRecipeForRenderer,
  GRADIENT_RENDERER,
  WALLPAPER_TEXTURE,
} from '~/lib/wallpaperMesh'
import type { TLinearGradientRecipe, TMeshGradientRecipe } from '~/lib/wallpaperMesh'
import type { TWallpaperThemeState } from '~/stores/wallpaper/spec'

type TWallpaperStatePatch = Partial<
  Omit<TWallpaperThemeState, 'contentShadow' | 'effect' | 'pattern' | 'texture'>
> & {
  contentShadow?: Partial<TWallpaperThemeState['contentShadow']>
  effect?: Partial<TWallpaperThemeState['effect']>
  pattern?: Partial<TWallpaperThemeState['pattern']>
  texture?: Partial<TWallpaperThemeState['texture']>
}

const createWallpaperState = (patch: TWallpaperStatePatch = {}): TWallpaperThemeState => {
  const { contentShadow, effect, pattern, texture, ...rest } = patch

  return {
    customWallpaper: null,
    source: GRADIENT_WALLPAPER_NAME.STONE_GREEN,
    type: WALLPAPER_TYPE.GRADIENT,
    gradient: null,
    ...rest,
    pattern: {
      enabled: false,
      id: DEFAULT_WALLPAPER_PATTERN_ID,
      intensity: 100,
      tone: WALLPAPER_PATTERN_TONE.DARK,
      ...pattern,
    },
    contentShadow: {
      enabled: false,
      ...contentShadow,
    },
    effect: {
      blurIntensity: 0,
      brightness: 100,
      saturation: 100,
      ...effect,
    },
    texture: {
      enabled: false,
      type: WALLPAPER_TEXTURE.NOISE,
      intensity: 0,
      params: {},
      ...texture,
    },
  }
}

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
        light: {
          source: mesh.preset,
          type: WALLPAPER_TYPE.GRADIENT,
          gradient: mesh,
          pattern: {
            enabled: false,
            id: DEFAULT_WALLPAPER_PATTERN_ID,
            intensity: 100,
            tone: WALLPAPER_PATTERN_TONE.DARK,
          },
          effect: { blurIntensity: 50, brightness: 100, saturation: 100 },
          contentShadow: { enabled: true },
        },
      },
    })

    const { result } = renderHook(() => useWallpaper(), { wrapper })

    expect(result.current.source).toBe(mesh.preset)
    expect(result.current.background).toContain('linear-gradient(135deg')
    expect(result.current.effect).toContain('blur')
  })

  it('resolves lagoon as liquid wallpaper', () => {
    const gradient = composeGradientRecipeForRenderer(
      GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.ROSE_AMBER_SKY],
      GRADIENT_RENDERER.LIQUID,
    )
    const renderSpec = adaptWallpaperBgRenderSpec(
      createWallpaperState({
        source: GRADIENT_WALLPAPER_NAME.ROSE_AMBER_SKY,
        type: WALLPAPER_TYPE.GRADIENT,
        gradient,
      }),
    )

    expect(renderSpec.type).toBe(BG_RENDER_TYPE.MESH_GRADIENT)
    expect(renderSpec.meshRecipe?.renderer).toBe(GRADIENT_RENDERER.LIQUID)
    expect(renderSpec.colors).toEqual(gradient.colors)
  })

  it('applies current gradient effects to the rendered wallpaper', () => {
    const wrapper = makeStoreWrapper({
      wallpaper: {
        light: {
          source: GRADIENT_WALLPAPER_NAME.TEAL_INDIGO_MAUVE,
          type: WALLPAPER_TYPE.GRADIENT,
          gradient: {
            ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.TEAL_INDIGO_MAUVE],
            angle: 90,
          },
          pattern: {
            enabled: true,
            id: DEFAULT_WALLPAPER_PATTERN_ID,
            intensity: 100,
            tone: WALLPAPER_PATTERN_TONE.DARK,
          },
          effect: { blurIntensity: 50, brightness: 100, saturation: 100 },
        },
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
        light: {
          source: 'backiee-1',
          type: WALLPAPER_TYPE.PATTERN,
          effect: { blurIntensity: 50, brightness: 85, saturation: 120 },
        },
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
        light: {
          source: 'backiee-1',
          type: WALLPAPER_TYPE.PATTERN,
          effect: { blurIntensity: 0, brightness: 100, saturation: 100 },
        },
      },
    })

    const { result } = renderHook(() => useWallpaper(), { wrapper })

    expect(result.current.background).toContain('center / cover no-repeat')
    expect(result.current.effect).not.toContain('!important')
    expect(result.current.effect).not.toContain('brightness')
    expect(result.current.effect).not.toContain('saturate')
  })

  it('resolves small texture renderSpec separately from CSS wallpaper output', () => {
    const renderSpec = adaptWallpaperBgRenderSpec(
      createWallpaperState({
        source: GRADIENT_WALLPAPER_NAME.STONE_GREEN,
        type: WALLPAPER_TYPE.GRADIENT,
        pattern: { enabled: false, intensity: 65, tone: WALLPAPER_PATTERN_TONE.DARK },
        texture: { enabled: true, type: WALLPAPER_TEXTURE.BEAM, intensity: 55, params: {} },
        gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.STONE_GREEN], angle: 90 },
        effect: { blurIntensity: 30, brightness: 90, saturation: 120 },
      }),
    )

    expect(renderSpec.type).toBe(BG_RENDER_TYPE.LINEAR_GRADIENT)
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
    const bg = {
      ...createWallpaperState({
        source: GRADIENT_WALLPAPER_NAME.STONE_GREEN,
        type: WALLPAPER_TYPE.GRADIENT,
        pattern: { enabled: true, intensity: 10, tone: WALLPAPER_PATTERN_TONE.DARK },
        gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.STONE_GREEN], angle: 90 },
        texture: { enabled: false, type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} },
      }),
    }
    const renderSpec = adaptWallpaperBgRenderSpec(bg)
    const directRenderSpec = composeBgRenderSpec(bg)

    expect(renderSpec.hasPattern).toBe(true)
    expect(renderSpec.patternOpacity).toBe(0.1)
    expect(renderSpec.background).toContain('linear-gradient(90deg')
    expect(renderSpec.background).not.toContain('/wallpaper/pattern/')
    expect(directRenderSpec.background).not.toContain('/wallpaper/pattern/')
  })

  it('resolves picture wallpaper from adapter-owned catalog', () => {
    const renderSpec = composeBgRenderSpec(
      {
        ...createWallpaperState({
          source: 'cover-only-picture',
          type: WALLPAPER_TYPE.PATTERN,
          pattern: { enabled: false, intensity: 0, tone: WALLPAPER_PATTERN_TONE.DARK },
          gradient: null,
          texture: { enabled: false, type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} },
        }),
      },
      {
        pictureCatalog: {
          'cover-only-picture': { image: '/cover/picture/custom.webp' },
        },
      },
    )

    expect(renderSpec.type).toBe(BG_RENDER_TYPE.IMAGE)
    expect(renderSpec.imageUrl).toBe('/cover/picture/custom.webp')
    expect(renderSpec.background).toBe('url(/cover/picture/custom.webp) center / cover no-repeat')
  })

  it('normalizes linear gradient spread as a centered transition band', () => {
    const renderSpec = adaptWallpaperBgRenderSpec(
      createWallpaperState({
        source: GRADIENT_WALLPAPER_NAME.STONE_GREEN,
        type: WALLPAPER_TYPE.GRADIENT,
        gradient: {
          ...(GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.STONE_GREEN] as TLinearGradientRecipe),
          spread: 0,
        },
      }),
    )

    expect(renderSpec.type).toBe(BG_RENDER_TYPE.LINEAR_GRADIENT)
    expect(renderSpec.colorStops).toEqual([46, 54])
  })

  it('normalizes radial gradient spread as outward palette reach', () => {
    const radialGradient = composeGradientRecipeForRenderer(
      GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.SKY_MAUVE_BLUE],
      GRADIENT_RENDERER.RADIAL,
    )
    if (radialGradient.renderer !== GRADIENT_RENDERER.RADIAL) throw new Error('expected radial')

    const renderSpec = adaptWallpaperBgRenderSpec(
      createWallpaperState({
        source: GRADIENT_WALLPAPER_NAME.SKY_MAUVE_BLUE,
        type: WALLPAPER_TYPE.GRADIENT,
        gradient: { ...radialGradient, spread: 50 },
      }),
    )

    expect(renderSpec.type).toBe(BG_RENDER_TYPE.RADIAL_GRADIENT)
    expect(renderSpec.colorStops).toEqual([0, 20, 39, 59])
    expect(renderSpec.background).toContain('radial-gradient')
    expect(renderSpec.background).not.toContain('transparent')
  })

  it('uses explicit radial gradient stops in the renderer render spec', () => {
    const radialGradient = composeGradientRecipeForRenderer(
      GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.SKY_MAUVE_BLUE],
      GRADIENT_RENDERER.RADIAL,
    )
    if (radialGradient.renderer !== GRADIENT_RENDERER.RADIAL) throw new Error('expected radial')

    const renderSpec = adaptWallpaperBgRenderSpec(
      createWallpaperState({
        source: GRADIENT_WALLPAPER_NAME.SKY_MAUVE_BLUE,
        type: WALLPAPER_TYPE.GRADIENT,
        gradient: { ...radialGradient, stops: [0, 20, 70, 100] },
      }),
    )

    expect(renderSpec.type).toBe(BG_RENDER_TYPE.RADIAL_GRADIENT)
    expect(renderSpec.colorStops).toEqual([0, 20, 70, 100])
  })

  it('falls back unsupported texture payloads to noise', () => {
    const renderSpec = adaptWallpaperBgRenderSpec(
      createWallpaperState({
        source: GRADIENT_WALLPAPER_NAME.STONE_GREEN,
        type: WALLPAPER_TYPE.GRADIENT,
        gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.STONE_GREEN], angle: 90 },
        texture: {
          enabled: true,
          type: 'unsupported-texture',
          intensity: 65,
          params: {},
        } as unknown as TWallpaperThemeState['texture'],
      }),
    )

    expect(renderSpec.texture).toEqual({
      type: WALLPAPER_TEXTURE.NOISE,
      intensity: 65,
      params: {},
    })
  })

  it('accepts dots texture renderSpecs', () => {
    const renderSpec = adaptWallpaperBgRenderSpec(
      createWallpaperState({
        source: GRADIENT_WALLPAPER_NAME.STONE_GREEN,
        type: WALLPAPER_TYPE.GRADIENT,
        gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.STONE_GREEN], angle: 90 },
        texture: { enabled: true, type: WALLPAPER_TEXTURE.DOTS, intensity: 70, params: {} },
      }),
    )

    expect(renderSpec.texture).toEqual({
      type: WALLPAPER_TEXTURE.DOTS,
      intensity: 70,
      params: {},
    })
  })

  it('accepts oil texture renderSpecs', () => {
    const renderSpec = adaptWallpaperBgRenderSpec(
      createWallpaperState({
        source: GRADIENT_WALLPAPER_NAME.STONE_GREEN,
        type: WALLPAPER_TYPE.GRADIENT,
        gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.STONE_GREEN], angle: 90 },
        texture: { enabled: true, type: WALLPAPER_TEXTURE.OIL, intensity: 70, params: {} },
      }),
    )

    expect(renderSpec.texture).toEqual({
      type: WALLPAPER_TEXTURE.OIL,
      intensity: 70,
      params: {},
    })
  })

  it('accepts tile texture renderSpecs', () => {
    const renderSpec = adaptWallpaperBgRenderSpec(
      createWallpaperState({
        source: GRADIENT_WALLPAPER_NAME.STONE_GREEN,
        type: WALLPAPER_TYPE.GRADIENT,
        gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.STONE_GREEN], angle: 90 },
        texture: { enabled: true, type: WALLPAPER_TEXTURE.TILE, intensity: 70, params: {} },
      }),
    )

    expect(renderSpec.texture).toEqual({
      type: WALLPAPER_TEXTURE.TILE,
      intensity: 70,
      params: {},
    })
  })

  it('keeps texture settings while marking them disabled', () => {
    const renderSpec = adaptWallpaperBgRenderSpec(
      createWallpaperState({
        source: GRADIENT_WALLPAPER_NAME.STONE_GREEN,
        type: WALLPAPER_TYPE.GRADIENT,
        gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.STONE_GREEN], angle: 90 },
        texture: { enabled: false, type: WALLPAPER_TEXTURE.TILE, intensity: 70, params: {} },
      }),
    )

    expect(renderSpec.hasTexture).toBe(false)
    expect(renderSpec.texture).toEqual({
      type: WALLPAPER_TEXTURE.TILE,
      intensity: 70,
      params: {},
    })
  })

  it('uses a light pattern color when pattern tone is light', () => {
    const renderSpec = adaptWallpaperBgRenderSpec(
      createWallpaperState({
        source: GRADIENT_WALLPAPER_NAME.VIOLET_TEAL_AMBER,
        type: WALLPAPER_TYPE.GRADIENT,
        pattern: { enabled: true, tone: WALLPAPER_PATTERN_TONE.LIGHT },
        gradient: GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.VIOLET_TEAL_AMBER],
      }),
    )

    expect(renderSpec.patternColor).toBe('#ffffff')
  })

  it('resolves mesh gradient texture renderSpec', () => {
    const renderSpec = adaptWallpaperBgRenderSpec(
      createWallpaperState({
        source: mesh.preset,
        type: WALLPAPER_TYPE.GRADIENT,
        gradient: mesh,
        texture: { enabled: true, type: WALLPAPER_TEXTURE.ASCII, intensity: 80, params: {} },
      }),
    )

    expect(renderSpec.type).toBe(BG_RENDER_TYPE.MESH_GRADIENT)
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
