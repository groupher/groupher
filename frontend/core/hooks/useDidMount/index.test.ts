import { renderHook, waitFor } from '@testing-library/react'
import useDidMount from '~/hooks/useDidMount'

it('returns false on first render and true after mount', async () => {
  const { result } = renderHook(() => useDidMount())

  expect(result.current).toBe(false)

  await waitFor(() => {
    expect(result.current).toBe(true)
  })
})
