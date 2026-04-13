import { renderHook } from '@testing-library/react'

import { COLOR } from '~/const/colors'
import METRIC from '~/const/metric'

import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useTopbar from '~/hooks/useTopbar'

describe('useTopbar', () => {
  it('gates by metric and topbarEnabled', () => {
    const wrapperA = makeStoreWrapper({
      metric: METRIC.COMMUNITY,
      dashboard: { topbarEnabled: true, topbarBg: COLOR.BLACK },
    })
    const a = renderHook(() => useTopbar(), { wrapper: wrapperA }).result
    expect(a.current.hasTopbar).toBe(true)

    const wrapperB = makeStoreWrapper({
      metric: METRIC.LANDING,
      dashboard: { topbarEnabled: true, topbarBg: COLOR.BLACK },
    })
    const b = renderHook(() => useTopbar(), { wrapper: wrapperB }).result
    expect(b.current.hasTopbar).toBe(false)
  })
})
