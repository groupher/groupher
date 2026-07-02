import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'

import useInitialNow, { InitialNowProvider } from '~/hooks/useInitialNow'

describe('useInitialNow', () => {
  it('reads initialNow from provider', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <InitialNowProvider initialNow={123}>{children}</InitialNowProvider>
    )

    const { result } = renderHook(() => useInitialNow(), { wrapper })

    expect(result.current).toBe(123)
  })

  it('returns null without provider', () => {
    const { result } = renderHook(() => useInitialNow())

    expect(result.current).toBeNull()
  })
})
