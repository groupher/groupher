import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'

import useNow, { NowProvider } from '~/hooks/useNow'

describe('useNow', () => {
  it('reads initialNow from provider', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NowProvider initialNow={123}>{children}</NowProvider>
    )

    const { result } = renderHook(() => useNow(), { wrapper })

    expect(result.current).toBe(123)
  })

  it('returns null without provider', () => {
    const { result } = renderHook(() => useNow())

    expect(result.current).toBeNull()
  })
})
