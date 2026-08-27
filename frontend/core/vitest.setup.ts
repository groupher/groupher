import '@testing-library/jest-dom/vitest'
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const router = await importOriginal<typeof import('@tanstack/react-router')>()

  return {
    ...router,
    useLocation: () => ({
      pathname: window.location.pathname,
      searchStr: window.location.search,
    }),
    useNavigate: () => (options: { to: string; replace?: boolean; resetScroll?: boolean }) => {
      const method = options.replace ? 'replaceState' : 'pushState'
      window.history[method](null, '', options.to)
      if (options.resetScroll !== false) window.scrollTo(0, 0)
      return Promise.resolve()
    },
    useRouter: () => ({
      invalidate: async () => {},
      preloadRoute: async () => {},
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
