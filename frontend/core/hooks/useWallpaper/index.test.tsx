import { renderHook } from '@testing-library/react'

import { WALLPAPER_TYPE } from '~/const/wallpaper'

import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useWallpaper from '~/hooks/useWallpaper'

describe('useWallpaper', () => {
  it('parses custom gradient wallpaper', () => {
    const wrapper = makeStoreWrapper({
      wallpaper: {
        wallpaper: 'custom',
        wallpaperType: WALLPAPER_TYPE.CUSTOM_GRADIENT,
        customColorValue: '#fff, #000',
        direction: 'bottom',
        hasPattern: false,
        hasBlur: true,
        hasShadow: true,
      },
    })

    const { result } = renderHook(() => useWallpaper(), { wrapper })

    expect(result.current.wallpaper).toBe('custom')
    expect(result.current.hasShadow).toBe(true)
    expect(result.current.background).toContain('linear-gradient(to bottom')
    expect(result.current.effect).toContain('blur')
  })
})
