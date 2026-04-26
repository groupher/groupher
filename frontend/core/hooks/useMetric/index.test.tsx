import { renderHook } from '@testing-library/react'

import METRIC from '~/const/metric'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useMetric from '~/hooks/useMetric'

describe('useMetric', () => {
  it('returns metric in normal and lowercase mode', () => {
    const wrapper = makeStoreWrapper({ metric: METRIC.LANDING })
    const { result } = renderHook(
      () => ({
        metric: useMetric(),
        lower: useMetric('lowercase'),
      }),
      { wrapper },
    )

    expect(result.current.metric).toBe(METRIC.LANDING)
    expect(result.current.lower).toBe(METRIC.LANDING.toLowerCase())
  })
})
