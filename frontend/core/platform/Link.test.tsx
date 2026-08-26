import { fireEvent, render, screen } from '@testing-library/react'

import { RouteScopeProvider, type TRouteScope } from './context'
import Link from './Link'

const createScope = (): TRouteScope => ({
  navi: {
    dsbRootSegment: 'dash',
    location: {
      pathname: '/home/post',
      search: '?mode=default',
      searchParams: new URLSearchParams('?mode=default'),
    },
    to: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(async () => {}),
    isActive: vi.fn(() => false),
  },
})

describe('Link', () => {
  it('renders a semantic href and delegates internal navigation to the route scope', () => {
    const scope = createScope()
    const route = { app: 'community' as const, community: 'home', path: 'post/42' }

    render(
      <RouteScopeProvider value={scope}>
        <Link route={route} previewId={42}>
          Open post
        </Link>
      </RouteScopeProvider>,
    )

    const link = screen.getByRole('link', { name: 'Open post' })
    expect(link).toHaveAttribute('href', '/home/post/42')
    fireEvent.click(link)
    expect(scope.navi.to).toHaveBeenCalledWith(route, {
      preserveSearch: undefined,
      previewId: 42,
      replace: undefined,
      scroll: undefined,
    })
  })
})
