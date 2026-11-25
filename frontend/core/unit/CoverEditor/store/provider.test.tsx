import { act, renderHook } from '@testing-library/react'

import { COVER_CANVAS_SIZE, COVER_IMAGE_WHICH } from '../constant'
import useCoverEditorStore from './hooks'
import CoverEditorProvider from './provider'

describe('CoverEditorProvider', () => {
  it('gives parallel canvas instances independent stores', () => {
    const first = renderHook(() => useCoverEditorStore(), { wrapper: CoverEditorProvider })
    const second = renderHook(() => useCoverEditorStore(), { wrapper: CoverEditorProvider })

    act(() => {
      first.result.current.commit({ canvasHeight: 612 })
    })

    expect(first.result.current).not.toBe(second.result.current)
    expect(first.result.current.canvasHeight).toBe(612)
    expect(second.result.current.canvasHeight).toBe(COVER_CANVAS_SIZE.HEIGHT)
    expect(first.result.current.images[COVER_IMAGE_WHICH.PRIMARY]).toBeNull()
    expect(second.result.current.images[COVER_IMAGE_WHICH.PRIMARY]).toBeNull()
  })

  it('creates a fresh canvas after an instance unmounts', () => {
    const first = renderHook(() => useCoverEditorStore(), { wrapper: CoverEditorProvider })

    act(() => {
      first.result.current.commit({ canvasHeight: 612 })
    })
    first.unmount()

    const reopened = renderHook(() => useCoverEditorStore(), { wrapper: CoverEditorProvider })

    expect(reopened.result.current.canvasHeight).toBe(COVER_CANVAS_SIZE.HEIGHT)
    expect(reopened.result.current.images[COVER_IMAGE_WHICH.PRIMARY]).toBeNull()
    expect(reopened.result.current).not.toBe(first.result.current)
  })
})
