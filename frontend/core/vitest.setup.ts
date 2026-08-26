import '@testing-library/jest-dom/vitest'
import type { RenderHookOptions, RenderOptions } from '@testing-library/react'
import type { ComponentType, ReactNode } from 'react'

/** Wraps Testing Library renders in an explicit route scope without adding a production fallback. */
vi.mock('@testing-library/react', async (importOriginal) => {
  const testingLibrary = await importOriginal<typeof import('@testing-library/react')>()
  const { createElement } = await import('react')
  const { RouteScopeProvider } = await import('~/platform')
  const testRouteScope = {
    navi: {
      location: {
        get pathname() {
          return window.location.pathname
        },
        get search() {
          return window.location.search
        },
        get searchParams() {
          return new URLSearchParams(window.location.search)
        },
      },
      to: vi.fn(),
      push: (href: string) => window.history.pushState(null, '', href),
      replace: (href: string) => window.history.replaceState(null, '', href),
      back: () => window.history.back(),
      forward: () => window.history.forward(),
      refresh: vi.fn(),
      prefetch: async () => {},
      isActive: vi.fn(() => false),
    },
  }

  const withRouteScope = (Wrapper?: ComponentType<{ children: ReactNode }>) =>
    function TestRouteScope({ children }: { children: ReactNode }) {
      const content = Wrapper ? createElement(Wrapper, null, children) : children
      return createElement(RouteScopeProvider, { value: testRouteScope, children: content })
    }

  return {
    ...testingLibrary,
    render: (ui: ReactNode, options: RenderOptions = {}) =>
      testingLibrary.render(ui, { ...options, wrapper: withRouteScope(options.wrapper) }),
    renderHook: <Result, Props>(
      hook: (initialProps: Props) => Result,
      options: RenderHookOptions<Props> = {},
    ) =>
      testingLibrary.renderHook(hook, {
        ...options,
        wrapper: withRouteScope(options.wrapper),
      }),
  }
})

// Keep unit tests on lightweight runtime constants instead of app-specific environment modules.
vi.mock('~/config', () => {
  return {
    ASSETS_HUB_ENDPOINT: 'https://assets-hub.example.test',
    ASSETS_HUB_READ_ENDPOINT: 'https://assets.example.test',
    PAGE_SIZE: { D: 20 },
    SITE_URL: 'https://example.test',
    DASH_SITE_URL: 'https://dash.example.test',
  }
})
