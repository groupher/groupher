import { fireEvent, render, screen } from '@testing-library/react'

import Link from './Link'

describe('Link', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/home')
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  })

  it('renders a semantic href for router navigation', () => {
    render(
      <Link href='/home/post/42' navigation='router'>
        Open post
      </Link>,
    )

    const link = screen.getByRole('link', { name: 'Open post' })
    expect(link).toHaveAttribute('href', '/home/post/42')
  })

  it('renders document navigation as a native link', () => {
    render(
      <Link href='https://example.com' navigation='document'>
        External
      </Link>,
    )

    expect(screen.getByRole('link', { name: 'External' })).toHaveAttribute(
      'href',
      'https://example.com',
    )
  })

  it.each([
    ['omitted', undefined, true],
    ['true', true, true],
    ['false', false, false],
  ])('maps scroll=%s to router resetScroll', (_label, scroll, shouldReset) => {
    render(
      <Link href='/home/post/42' navigation='router' scroll={scroll}>
        Open post
      </Link>,
    )

    fireEvent.click(screen.getByRole('link', { name: 'Open post' }))

    if (shouldReset) expect(window.scrollTo).toHaveBeenCalledWith(0, 0)
    else expect(window.scrollTo).not.toHaveBeenCalled()
  })

  it('uses a private route for router navigation while exposing the canonical mask', () => {
    render(
      <Link
        href='/home/post/42'
        navigation='router'
        mask={{ to: '/home/post/previewer/42', visibleHref: '/home/post/42' }}
        scroll={false}
      >
        Open preview
      </Link>,
    )

    const link = screen.getByRole('link', { name: 'Open preview' })
    expect(link).toHaveAttribute('href', '/home/post/42')
    fireEvent.click(link)
    expect(window.location.pathname).toBe('/home/post/previewer/42')
  })
})
