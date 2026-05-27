import { renderHook } from '@testing-library/react'

import { GRADIENT_WALLPAPER_NAME, WALLPAPER_TYPE } from '~/const/wallpaper'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useWallpaper, { resolveWallpaperRenderDescriptor } from '~/hooks/useWallpaper'
import { stringifyMeshGradientRecipe } from '~/lib/wallpaperMesh'

describe('useWallpaper', () => {
  it('parses custom gradient wallpaper', () => {
    const wrapper = makeStoreWrapper({
      wallpaper: {
        source: 'custom',
        type: WALLPAPER_TYPE.CUSTOM_GRADIENT,
        customColorValue: '#fff, #000',
        direction: '180deg',
        hasPattern: false,
        blurIntensity: 50,
        hasShadow: true,
      },
    })

    const { result } = renderHook(() => useWallpaper(), { wrapper })

    expect(result.current.source).toBe('custom')
    expect(result.current.hasShadow).toBe(true)
    expect(result.current.background).toContain('linear-gradient(180deg')
    expect(result.current.effect).toContain('blur')
  })

  it('applies current gradient effects to the rendered wallpaper', () => {
    const wrapper = makeStoreWrapper({
      wallpaper: {
        source: GRADIENT_WALLPAPER_NAME.PURPLE,
        type: WALLPAPER_TYPE.GRADIENT,
        direction: '90deg',
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
      customColorValue: '',
      source: GRADIENT_WALLPAPER_NAME.GREEN,
      type: WALLPAPER_TYPE.GRADIENT,
      hasPattern: true,
      blurIntensity: 30,
      hasShadow: false,
      brightness: 90,
      saturation: 120,
      textureType: 'dither',
      textureStrength: 55,
      direction: '90deg',
      bgSize: 'cover',
    })

    expect(descriptor.kind).toBe('linear-gradient')
    expect(descriptor.texture).toEqual({ type: 'dither', strength: 55 })
    expect(descriptor.background).not.toContain('data:image')
  })

  it('resolves DIY mesh texture descriptor when source is empty', () => {
    const customColorValue = stringifyMeshGradientRecipe({
      version: 1,
      kind: 'mesh',
      preset: 'test',
      seed: 1,
      colors: ['#fbeede', '#ff7f6f', '#5f74a6'],
      flow: 135,
      softness: 60,
      texture: { type: 'screentone', strength: 80 },
      contrast: 100,
      brightness: 100,
      anchors: [
        { x: 0.2, y: 0.2, color: 0 },
        { x: 0.78, y: 0.82, color: 2 },
      ],
    })

    const descriptor = resolveWallpaperRenderDescriptor({
      customWallpaper: null,
      customColorValue,
      source: '',
      type: WALLPAPER_TYPE.CUSTOM_GRADIENT,
      hasPattern: false,
      blurIntensity: 0,
      hasShadow: false,
      brightness: 100,
      saturation: 100,
      textureType: 'grain',
      textureStrength: 0,
      direction: '180deg',
      bgSize: 'cover',
    })

    expect(descriptor.kind).toBe('mesh-gradient')
    expect(descriptor.texture).toEqual({ type: 'screentone', strength: 80 })
    expect(descriptor.flow).toBe(135)
    expect(descriptor.meshRecipe?.anchors).toHaveLength(2)
  })
})
