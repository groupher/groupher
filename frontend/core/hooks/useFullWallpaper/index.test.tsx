import { act, renderHook, waitFor } from '@testing-library/react'

import { GRADIENT_WALLPAPER_NAME, WALLPAPER_TYPE } from '~/const/wallpaper'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useFullWallpaper from '~/hooks/useFullWallpaper'
import type { TWallpaperGradient } from '~/spec'

describe('useFullWallpaper', () => {
  it('returns data and can commit wallpaper changes', async () => {
    const wrapper = makeStoreWrapper({
      wallpaper: {
        source: GRADIENT_WALLPAPER_NAME.PINK,
        type: WALLPAPER_TYPE.GRADIENT,
        hasPattern: true,
        hasBlur: false,
        direction: '180deg',
      },
    })

    const { result } = renderHook(() => useFullWallpaper(), { wrapper })

    const data = result.current.getWallpaper()
    expect(data.source).toBe(GRADIENT_WALLPAPER_NAME.PINK)
    expect(data.type).toBe(WALLPAPER_TYPE.GRADIENT)

    const pink = data.gradientWallpapers.pink
    expect('colors' in pink).toBe(true)
    expect((pink as TWallpaperGradient).hasPattern).toBe(true)

    act(() => result.current.changePatternWallpaper('dots'))

    await waitFor(() => {
      expect(result.current.source).toBe('dots')
    })
  })
})
