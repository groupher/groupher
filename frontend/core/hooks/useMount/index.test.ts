import { renderHook } from '@testing-library/react'

import useMount from '~/hooks/useMount'

it('runs mount effect once and calls cleanup on unmount', () => {
  const cleanup = vi.fn()
  const effect = vi.fn(() => cleanup)

  const { unmount } = renderHook(() => useMount(effect))

  expect(effect).toHaveBeenCalledTimes(1)
  unmount()
  expect(cleanup).toHaveBeenCalledTimes(1)
})
