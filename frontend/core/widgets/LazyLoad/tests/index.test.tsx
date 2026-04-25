import { render, screen, waitFor } from '@testing-library/react'

import LazyLoad from '..'

type TWindowWithIO = Window & {
  IntersectionObserver?: typeof IntersectionObserver
}

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
    const ioWindow = window as TWindowWithIO
    const original = ioWindow.IntersectionObserver
    // Ensure `('IntersectionObserver' in window)` is false.
    // biome-ignore lint/performance/noDelete: test-only
    delete ioWindow.IntersectionObserver

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
        ioWindow.IntersectionObserver = original
      } else {
        // biome-ignore lint/performance/noDelete: test-only
        delete ioWindow.IntersectionObserver
      }
    }
  })
})
