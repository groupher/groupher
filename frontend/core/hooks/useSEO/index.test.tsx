import { renderHook } from '@testing-library/react'

import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useSEO from '~/hooks/useSEO'

describe('useSEO', () => {
  it('returns seo config projection', () => {
    const wrapper = makeStoreWrapper({
      dashboard: {
        seoEnable: true,
        ogTitle: 'OG title',
        twTitle: 'TW title',
      },
    })

    const { result } = renderHook(() => useSEO(), { wrapper })
    expect(result.current.seoEnable).toBe(true)
    expect(result.current.ogTitle).toBe('OG title')
    expect(result.current.twTitle).toBe('TW title')
  })
})
