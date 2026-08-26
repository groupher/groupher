import { render, screen, waitFor } from '@testing-library/react'
import { renderToString } from 'react-dom/server'

import THEME, { THEME_MODE } from '~/const/theme'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import { RouteScopeProvider, type TRouteScope } from '~/platform'
import setupThemeStore from '~/stores/theme'
import { StoreContext } from '~/stores/theme/context'
import ThemeSwitch from '~/ui/ThemeSwitch'

describe('<ThemeSwitch />', () => {
  it('keeps the SSR-safe system placeholder until hydration completes', async () => {
    const store = setupThemeStore(THEME_MODE.LIGHT, THEME.LIGHT)
    const Wrapper = makeStoreWrapper()
    const routeScope: TRouteScope = {
      navi: {
        location: {
          pathname: '/home',
          search: '',
          searchParams: new URLSearchParams(),
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
    }
    const ui = (
      <RouteScopeProvider value={routeScope}>
        <Wrapper>
          <StoreContext.Provider value={store}>
            <ThemeSwitch />
          </StoreContext.Provider>
        </Wrapper>
      </RouteScopeProvider>
    )

    expect(renderToString(ui)).toContain('system mode')

    render(ui)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'light mode' })).toBeInTheDocument()
    })
  })
})
