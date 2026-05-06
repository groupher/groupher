import { renderHook } from '@testing-library/react'

import { NAV_ACTIVE_LAYOUT } from '~/const/layout'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useNavActiveLayoutSalon from '~/hooks/useNavActiveLayoutSalon'

describe('useNavActiveLayoutSalon', () => {
  it('falls back to text when dashboard layout is invalid', () => {
    const wrapper = makeStoreWrapper({
      dashboard: {
        navActiveLayout: 'invalid-layout' as never,
      },
    })

    const { result } = renderHook(() => useNavActiveLayoutSalon(), { wrapper })

    expect(result.current.item).toContain('text-rainbow')
    expect(result.current.item).not.toContain('bg-rainbow')
  })

  it('prefers explicit layout prop over dashboard value', () => {
    const wrapper = makeStoreWrapper({
      dashboard: {
        navActiveLayout: NAV_ACTIVE_LAYOUT.TEXT,
      },
    })

    const { result } = renderHook(
      () => useNavActiveLayoutSalon({ layout: NAV_ACTIVE_LAYOUT.SOFT_BG }),
      { wrapper },
    )

    expect(result.current.item).toContain('bg-rainbow')
    expect(result.current.item).toContain('Soft')
  })
})
