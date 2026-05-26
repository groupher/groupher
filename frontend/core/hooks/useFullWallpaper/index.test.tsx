import { act, renderHook, waitFor } from '@testing-library/react'

import { GRADIENT_WALLPAPER_NAME, WALLPAPER_TYPE } from '~/const/wallpaper'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useFullWallpaper from '~/hooks/useFullWallpaper'
import type { TWallpaperGradient, TWallpaperPic } from '~/spec'

describe('useFullWallpaper', () => {
  it('returns data and can commit wallpaper changes', async () => {
    const wrapper = makeStoreWrapper({
      wallpaper: {
        source: GRADIENT_WALLPAPER_NAME.PINK,
        type: WALLPAPER_TYPE.GRADIENT,
        hasPattern: true,
        hasBlur: false,
        brightness: 100,
        saturation: 100,
        direction: '180deg',
      },
    })

    const { result } = renderHook(() => useFullWallpaper(), { wrapper })

    const data = result.current.getWallpaper()
    expect(data.source).toBe(GRADIENT_WALLPAPER_NAME.PINK)
    expect(data.type).toBe(WALLPAPER_TYPE.GRADIENT)
    expect(data.brightness).toBe(100)
    expect(data.saturation).toBe(100)

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
        hasBlur: true,
        direction: '90deg',
      },
    })

    const { result } = renderHook(() => useFullWallpaper(), { wrapper })
    const data = result.current.getWallpaper()

    const active = data.gradientWallpapers[GRADIENT_WALLPAPER_NAME.PURPLE] as TWallpaperGradient
    const defaultPattern = data.gradientWallpapers[
      GRADIENT_WALLPAPER_NAME.GREEN
    ] as TWallpaperGradient

    expect(active.hasPattern).toBe(false)
    expect(active.hasBlur).toBe(false)
    expect(active.direction).toBe('180deg')

    expect(defaultPattern.hasPattern).toBe(false)
    expect(defaultPattern.hasBlur).toBe(false)
    expect(defaultPattern.direction).toBe('180deg')
  })

  it('keeps pattern catalog previews static', () => {
    const wrapper = makeStoreWrapper({
      wallpaper: {
        source: 'country-1',
        type: WALLPAPER_TYPE.PATTERN,
        hasBlur: true,
        brightness: 75,
        saturation: 130,
      },
    })

    const { result } = renderHook(() => useFullWallpaper(), { wrapper })
    const data = result.current.getWallpaper()

    const active = data.patternWallpapers['country-1'] as TWallpaperPic
    const inactive = data.patternWallpapers.newspaper as TWallpaperPic

    expect(active.hasBlur).toBe(false)
    expect(active.brightness).toBeUndefined()
    expect(active.saturation).toBeUndefined()
    expect(active.image).toBe('/wallpaper/picture/country-1.webp')
    expect(active.preview).toBe('/wallpaper/picture-preview/country-1.webp')
    expect(inactive.hasBlur).toBe(false)
  })
})
