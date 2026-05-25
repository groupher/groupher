import { renderHook } from '@testing-library/react'

import { WALLPAPER_TYPE } from '~/const/wallpaper'
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
})
