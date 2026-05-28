import { act, renderHook, waitFor } from '@testing-library/react'

import { GRADIENT_WALLPAPER_NAME, WALLPAPER_TYPE } from '~/const/wallpaper'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useFullWallpaper from '~/hooks/useFullWallpaper'
import { WALLPAPER_TEXTURE } from '~/lib/wallpaperMesh'
import type { TWallpaperGradient, TWallpaperPic } from '~/spec'

describe('useFullWallpaper', () => {
  it('returns data and can commit wallpaper changes', async () => {
    const wrapper = makeStoreWrapper({
      wallpaper: {
        source: GRADIENT_WALLPAPER_NAME.PINK,
        type: WALLPAPER_TYPE.GRADIENT,
        hasPattern: true,
        blurIntensity: 0,
        brightness: 100,
        saturation: 100,
        texture: { type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} },
        gradientDeg: 180,
      },
    })

    const { result } = renderHook(() => useFullWallpaper(), { wrapper })

    const data = result.current.getWallpaper()
    expect(data.source).toBe(GRADIENT_WALLPAPER_NAME.PINK)
    expect(data.type).toBe(WALLPAPER_TYPE.GRADIENT)
    expect(data.brightness).toBe(100)
    expect(data.saturation).toBe(100)
    expect(data.texture).toEqual({ type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} })

    const pink = data.gradientWallpapers.pink
    expect('colors' in pink).toBe(true)
    expect((pink as TWallpaperGradient).hasPattern).toBe(false)

    act(() => result.current.changePatternWallpaper('dots'))

    await waitFor(() => {
      expect(result.current.source).toBe('dots')
    })
  })

  it('keeps gradient catalog previews static', () => {
    const wrapper = makeStoreWrapper({
      wallpaper: {
        source: GRADIENT_WALLPAPER_NAME.PURPLE,
        type: WALLPAPER_TYPE.GRADIENT,
        hasPattern: true,
        blurIntensity: 50,
        gradientDeg: 90,
      },
    })

    const { result } = renderHook(() => useFullWallpaper(), { wrapper })
    const data = result.current.getWallpaper()

    const active = data.gradientWallpapers[GRADIENT_WALLPAPER_NAME.PURPLE] as TWallpaperGradient
    const defaultPattern = data.gradientWallpapers[
      GRADIENT_WALLPAPER_NAME.GREEN
    ] as TWallpaperGradient

    expect(active.hasPattern).toBe(false)
    expect(active.blurIntensity).toBe(0)
    expect(active.direction).toBe('180deg')

    expect(defaultPattern.hasPattern).toBe(false)
    expect(defaultPattern.blurIntensity).toBe(0)
    expect(defaultPattern.direction).toBe('180deg')
  })

  it('keeps pattern catalog previews static', () => {
    const wrapper = makeStoreWrapper({
      wallpaper: {
        source: 'backiee-1',
        type: WALLPAPER_TYPE.PATTERN,
        blurIntensity: 50,
        brightness: 75,
        saturation: 130,
      },
    })

    const { result } = renderHook(() => useFullWallpaper(), { wrapper })
    const data = result.current.getWallpaper()

    const active = data.patternWallpapers['backiee-1'] as TWallpaperPic
    const inactive = data.patternWallpapers['backiee-2'] as TWallpaperPic

    expect(active.blurIntensity).toBe(0)
    expect(active.brightness).toBeUndefined()
    expect(active.saturation).toBeUndefined()
    expect(active.image).toBe('/wallpaper/picture/backiee-1.webp')
    expect(active.preview).toBe('/wallpaper/picture-preview/backiee-1.webp')
    expect(inactive.blurIntensity).toBe(0)
  })
})
