import { act, renderHook, waitFor } from '@testing-library/react'

import METRIC from '~/const/metric'
import { WALLPAPER_TYPE } from '~/const/wallpaper'

import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useDashboard from '~/hooks/useDashboard'
import useGlowLight from '~/hooks/useGlowLight'

describe('useGlowLight', () => {
  it('disables glow in APPLY_COMMUNITY metric and can change effect', async () => {
    const wrapper = makeStoreWrapper({
      metric: METRIC.APPLY_COMMUNITY,
      dashboard: { glowType: 'x', glowFixed: true, glowOpacity: 'normal' },
    })

    const { result } = renderHook(
      () => ({
        glow: useGlowLight(),
        dashboard: useDashboard(),
      }),
      { wrapper },
    )

    expect(result.current.glow.glowType).toBeNull()
    expect(result.current.glow.glowFixed).toBe(false)

    act(() => result.current.glow.changeGlowEffect('orange-purple'))

    await waitFor(() => {
      expect(result.current.dashboard.glowType).toBe('orange-purple')
    })
  })

  it('disables glow on landing when wallpaper is not PINK', () => {
    const wrapper = makeStoreWrapper({
      metric: METRIC.LANDING,
      wallpaper: { wallpaper: 'blue', wallpaperType: WALLPAPER_TYPE.GRADIENT },
      dashboard: { glowType: null },
    })

    const { result } = renderHook(() => useGlowLight(), { wrapper })
    expect(result.current.glowType).toBeNull()
  })
})
