import { act, renderHook } from '@testing-library/react'
import { createRef } from 'react'

import { THREAD } from '~/constant/thread'

import useTrackArticleView from './useTrackArticleView'

const { trackArticleView } = vi.hoisted(() => ({ trackArticleView: vi.fn() }))
vi.mock('~/query/viewTracker', () => ({ trackArticleView }))

describe('useTrackArticleView', () => {
  let callback: IntersectionObserverCallback
  const observe = vi.fn()
  const disconnect = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    trackArticleView.mockReset()
    trackArticleView.mockResolvedValue({ tracked: true })
    observe.mockReset()
    disconnect.mockReset()
    class TestIntersectionObserver {
      constructor(nextCallback: IntersectionObserverCallback) {
        callback = nextCallback
      }

      disconnect = disconnect
      observe = observe
      takeRecords = vi.fn()
      unobserve = vi.fn()
      root = null
      rootMargin = ''
      thresholds = []
    }

    vi.stubGlobal('IntersectionObserver', TestIntersectionObserver)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('does not track until ready content is actually visible, then tracks once', () => {
    const ref = createRef<HTMLDivElement>()
    Object.defineProperty(ref, 'current', { value: document.createElement('div') })
    const article = { community: 'home', innerId: 42, thread: THREAD.POST }
    const { rerender } = renderHook(({ ready }) => useTrackArticleView(ref, article, ready), {
      initialProps: { ready: false },
    })

    expect(trackArticleView).not.toHaveBeenCalled()
    rerender({ ready: true })
    expect(observe).toHaveBeenCalledWith(ref.current)

    act(() => callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as never))
    act(() => callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as never))
    act(() => vi.advanceTimersByTime(1_000))

    expect(trackArticleView).toHaveBeenCalledOnce()
    expect(trackArticleView).toHaveBeenCalledWith(article)
  })

  it('waits until a background tab becomes visible', () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    })
    const ref = createRef<HTMLDivElement>()
    Object.defineProperty(ref, 'current', { value: document.createElement('div') })
    const article = { community: 'home', innerId: 42, thread: THREAD.POST }

    renderHook(() => useTrackArticleView(ref, article, true))
    act(() => callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as never))
    act(() => vi.advanceTimersByTime(1_000))
    expect(trackArticleView).not.toHaveBeenCalled()

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    act(() => vi.advanceTimersByTime(999))
    expect(trackArticleView).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(trackArticleView).toHaveBeenCalledOnce()
  })

  it('does not count an Article that leaves the viewport before one second', () => {
    const ref = createRef<HTMLDivElement>()
    Object.defineProperty(ref, 'current', { value: document.createElement('div') })
    const article = { community: 'home', innerId: 42, thread: THREAD.POST }

    renderHook(() => useTrackArticleView(ref, article, true))
    act(() => callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as never))
    act(() => vi.advanceTimersByTime(999))
    act(() => callback([{ isIntersecting: false } as IntersectionObserverEntry], {} as never))
    act(() => vi.advanceTimersByTime(10))

    expect(trackArticleView).not.toHaveBeenCalled()
  })
})
