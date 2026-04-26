import { renderHook } from '@testing-library/react'

import { COLOR } from '~/const/colors'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useSubPrimaryColor from '~/hooks/useSubPrimaryColor'

describe('useSubPrimaryColor', () => {
  it('reads subPrimaryColor from dashboard store', () => {
    const wrapper = makeStoreWrapper({ dashboard: { subPrimaryColor: COLOR.PURPLE } })
    const { result } = renderHook(() => useSubPrimaryColor(), { wrapper })

    expect(result.current).toBe(COLOR.PURPLE)
  })
})
