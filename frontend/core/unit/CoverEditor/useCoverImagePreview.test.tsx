import { act, renderHook } from '@testing-library/react'

import { COVER_IMAGE_WHICH } from './constant'
import { createCoverImageConfig } from './coverImageModel'
import useCoverImagePreview from './useCoverImagePreview'

const logic = vi.hoisted(() => ({
  imagePatchOnChange: vi.fn(),
  imagesOnChange: vi.fn(),
  primary: null as ReturnType<typeof createCoverImageConfig> | null,
  secondary: null as ReturnType<typeof createCoverImageConfig> | null,
}))

vi.mock('./useLogic', () => ({
  default: () => ({
    activeImageWhich: COVER_IMAGE_WHICH.PRIMARY,
    canvasHeight: 360,
    canvasWidth: 720,
    images: {
      primary: logic.primary,
      secondary: logic.secondary,
    },
    imagePatchOnChange: logic.imagePatchOnChange,
    imagesOnChange: logic.imagesOnChange,
  }),
}))

describe('useCoverImagePreview', () => {
  let frameId = 0
  let frames: Map<number, FrameRequestCallback>

  const flushAnimationFrame = (): void => {
    const pendingFrames = [...frames.entries()]
    frames.clear()
    for (const [, callback] of pendingFrames) callback(performance.now())
  }

  beforeEach(() => {
    vi.useFakeTimers()
    logic.primary = createCoverImageConfig(COVER_IMAGE_WHICH.PRIMARY, 'primary.png')
    logic.secondary = createCoverImageConfig(COVER_IMAGE_WHICH.SECONDARY, 'secondary.png')
    logic.imagePatchOnChange.mockClear()
    logic.imagesOnChange.mockClear()
    frames = new Map()
    frameId = 0
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frameId += 1
      frames.set(frameId, callback)
      return frameId
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('keeps pointer preview patches out of React context state', () => {
    const { result } = renderHook(() => useCoverImagePreview())
    const initialContext = result.current

    act(() => {
      result.current.scheduleImagePatch(COVER_IMAGE_WHICH.PRIMARY, {
        position: { x: 0.6, y: 0.4 },
      })
      flushAnimationFrame()
    })

    expect(result.current).toBe(initialContext)
    expect(result.current.images.primary?.position).toEqual({ x: 0.5, y: 0.5 })
  })

  it('still synchronizes structural image activation to context consumers', () => {
    const { result } = renderHook(() => useCoverImagePreview())

    act(() => {
      result.current.activateImageDraft(COVER_IMAGE_WHICH.SECONDARY)
      flushAnimationFrame()
    })

    expect(result.current.activeImageWhich).toBe(COVER_IMAGE_WHICH.SECONDARY)
    expect(logic.imagesOnChange).toHaveBeenCalledOnce()
  })

  it('coalesces a structural sync with the latest patch from the same frame', () => {
    const { result } = renderHook(() => useCoverImagePreview())

    act(() => {
      result.current.activateImageDraft(COVER_IMAGE_WHICH.SECONDARY)
      result.current.scheduleImagePatch(COVER_IMAGE_WHICH.SECONDARY, {
        position: { x: 0.7, y: 0.3 },
      })
      flushAnimationFrame()
    })

    expect(result.current.activeImageWhich).toBe(COVER_IMAGE_WHICH.SECONDARY)
    expect(result.current.images.secondary?.position).toEqual({ x: 0.7, y: 0.3 })
  })
})
