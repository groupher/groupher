import { renderHook } from '@testing-library/react'

import { GRADIENT_WALLPAPER_NAME, WALLPAPER_TYPE } from '~/const/wallpaper'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useWallpaper from '~/hooks/useWallpaper'

describe('useWallpaper', () => {
  it('parses custom gradient wallpaper', () => {
    const wrapper = makeStoreWrapper({
      wallpaper: {
        source: 'custom',
        type: WALLPAPER_TYPE.CUSTOM_GRADIENT,
        customColorValue: '#fff, #000',
        direction: '180deg',
        hasPattern: false,
        hasBlur: true,
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
        hasBlur: true,
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
        source: 'country-1',
        type: WALLPAPER_TYPE.PATTERN,
        hasBlur: true,
        brightness: 85,
        saturation: 120,
      },
    })

    const { result } = renderHook(() => useWallpaper(), { wrapper })

    expect(result.current.background).toBe('url(/wallpaper/picture/country-1.webp)')
    expect(result.current.background).not.toContain('picture-preview')
    expect(result.current.effect).toContain('blur')
    expect(result.current.effect).toContain('brightness(85%)')
    expect(result.current.effect).toContain('saturate(120%)')
  })

  it('keeps default picture adjustment values out of the filter', () => {
    const wrapper = makeStoreWrapper({
      wallpaper: {
        source: 'country-1',
        type: WALLPAPER_TYPE.PATTERN,
        brightness: 100,
        saturation: 100,
      },
    })

    const { result } = renderHook(() => useWallpaper(), { wrapper })

    expect(result.current.effect).toContain('background-size: contain')
    expect(result.current.effect).not.toContain('!important')
    expect(result.current.effect).not.toContain('brightness')
    expect(result.current.effect).not.toContain('saturate')
  })
})
