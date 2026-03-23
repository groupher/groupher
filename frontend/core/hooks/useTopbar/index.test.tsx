import { renderHook } from '@testing-library/react'

import { COLOR } from '~/const/colors'
import { TOPBAR_LAYOUT } from '~/const/layout'
import METRIC from '~/const/metric'

import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useTopbar from '~/hooks/useTopbar'

describe('useTopbar', () => {
  it('gates by metric and topbarLayout', () => {
    const wrapperA = makeStoreWrapper({
      metric: METRIC.COMMUNITY,
      dashboard: { topbarLayout: TOPBAR_LAYOUT.YES, topbarBg: COLOR.BLACK },
    })
    const a = renderHook(() => useTopbar(), { wrapper: wrapperA }).result
    expect(a.current.hasTopbar).toBe(true)

    const wrapperB = makeStoreWrapper({
      metric: METRIC.LANDING,
      dashboard: { topbarLayout: TOPBAR_LAYOUT.YES, topbarBg: COLOR.BLACK },
    })
    const b = renderHook(() => useTopbar(), { wrapper: wrapperB }).result
    expect(b.current.hasTopbar).toBe(false)
  })
})
