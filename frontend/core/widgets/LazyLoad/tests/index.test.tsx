import { render, screen, waitFor } from '@testing-library/react'

import LazyLoad from '..'

describe('<LazyLoad />', () => {
  it('renders content immediately when visibleByDefault=true', async () => {
    const onVisible = vi.fn()

    render(
      <LazyLoad visibleByDefault onVisible={onVisible} placeholder={<span>loading</span>}>
        <span>content</span>
      </LazyLoad>,
    )

    expect(screen.getByText('content')).toBeInTheDocument()
    await waitFor(() => expect(onVisible).toHaveBeenCalledTimes(1))
  })

  it('falls back to visible when IntersectionObserver is missing', async () => {
    const onVisible = vi.fn()

    const hadObserver = 'IntersectionObserver' in window
    const original = (window as any).IntersectionObserver
    // Ensure `('IntersectionObserver' in window)` is false.
    // biome-ignore lint/performance/noDelete: test-only
    delete (window as any).IntersectionObserver

    try {
      render(
        <LazyLoad onVisible={onVisible} placeholder={<span>loading</span>}>
          {(visible) => <span>{visible ? 'content' : 'hidden'}</span>}
        </LazyLoad>,
      )

      await waitFor(() => expect(screen.getByText('content')).toBeInTheDocument())
      expect(onVisible).toHaveBeenCalledTimes(1)
    } finally {
      if (hadObserver) {
        ;(window as any).IntersectionObserver = original
      } else {
        // biome-ignore lint/performance/noDelete: test-only
        delete (window as any).IntersectionObserver
      }
    }
  })
})
