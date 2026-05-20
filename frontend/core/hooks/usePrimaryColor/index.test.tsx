import { renderHook } from '@testing-library/react'

import { COLOR } from '~/const/colors'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import usePrimaryColor from '~/hooks/usePrimaryColor'

describe('usePrimaryColor', () => {
  it('reads primaryColor from theme preset tokens', () => {
    const wrapper = makeStoreWrapper({ dashboard: { themeTokens: { primaryColor: COLOR.ORANGE } } })
    const { result } = renderHook(() => usePrimaryColor(), { wrapper })
    expect(result.current).toBe(COLOR.ORANGE)
  })
})
