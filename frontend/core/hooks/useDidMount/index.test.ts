import { renderHook } from '@testing-library/react'
import useDidMount from '~/hooks/useDidMount'

it('returns false on first render and true after mount', async () => {
  const { result } = renderHook(() => useDidMount())

  // hydration / first render
  expect(result.current).toBe(false)

  // effect runs after mount
  await Promise.resolve()
  expect(result.current).toBe(true)
})
