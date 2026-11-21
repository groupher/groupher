import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'

vi.mock('~/ui/Buttons/Button', () => ({
  default: ({
    ariaLabel,
    children,
    disabled,
    onClick,
  }: {
    ariaLabel?: string
    children?: ReactNode
    disabled?: boolean
    onClick?: () => void
  }) => (
    <button type='button' aria-label={ariaLabel} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
}))

import CursorPagination from './CursorPagination'

it('automatically loads once per intersection and pauses on pending, errors and the terminal page', () => {
  let intersect: IntersectionObserverCallback
  const disconnect = vi.fn()
  const observe = vi.fn()
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        intersect = callback
      }
      observe = observe
      disconnect = disconnect
    },
  )
  const load = vi.fn()
  const retry = vi.fn()
  const props = {
    mode: 'INFINITE_SCROLL' as const,
    hasNextPage: true,
    isLoading: false,
    onLoadMore: load,
    onRetry: retry,
  }
  try {
    const { rerender, unmount } = render(<CursorPagination {...props} />)
    expect(screen.queryByRole('button')).toBeNull()
    const enter = () =>
      act(() =>
        intersect(
          [{ isIntersecting: true }] as IntersectionObserverEntry[],
          {} as IntersectionObserver,
        ),
      )
    enter()
    enter()
    expect(load).toHaveBeenCalledTimes(1)
    rerender(<CursorPagination {...props} isLoading />)
    expect(disconnect).toHaveBeenCalledTimes(1)
    enter()
    expect(load).toHaveBeenCalledTimes(1)
    rerender(<CursorPagination {...props} error={new Error('next failed')} />)
    expect(observe).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: '重试下一页加载' }))
    expect(retry).toHaveBeenCalledTimes(1)
    rerender(<CursorPagination {...props} />)
    enter()
    expect(load).toHaveBeenCalledTimes(2)
    rerender(<CursorPagination {...props} hasNextPage={false} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(observe).toHaveBeenCalledTimes(2)
    unmount()
  } finally {
    vi.unstubAllGlobals()
  }
})

it('keeps load_more manual and falls back to an accessible button without observer support', () => {
  vi.stubGlobal('IntersectionObserver', undefined)
  const load = vi.fn()
  try {
    const { rerender } = render(
      <CursorPagination mode='LOAD_MORE' hasNextPage isLoading={false} onLoadMore={load} />,
    )
    expect(load).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '加载更多' }))
    expect(load).toHaveBeenCalledTimes(1)
    rerender(
      <CursorPagination mode='INFINITE_SCROLL' hasNextPage isLoading={false} onLoadMore={load} />,
    )
    fireEvent.click(screen.getByRole('button', { name: '加载更多' }))
    expect(load).toHaveBeenCalledTimes(2)
  } finally {
    vi.unstubAllGlobals()
  }
})
