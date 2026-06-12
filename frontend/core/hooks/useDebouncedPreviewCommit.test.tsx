import { act, renderHook } from '@testing-library/react'

import useDebouncedPreviewCommit from '~/hooks/useDebouncedPreviewCommit'

describe('useDebouncedPreviewCommit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('normalizes the empty pending container before custom merge', () => {
    const onCommit = vi.fn()
    const mergePatch = vi.fn((current, patch) => ({
      ...current,
      ...patch,
    }))

    const { result } = renderHook(() =>
      useDebouncedPreviewCommit<{ value: number | null }>({
        mergePatch,
        onCommit,
      }),
    )

    act(() => {
      result.current.schedule({ value: null })
    })

    expect(mergePatch).toHaveBeenCalledWith({}, { value: null })

    act(() => {
      vi.runOnlyPendingTimers()
    })

    expect(onCommit).toHaveBeenCalledWith({ value: null })
  })
})
