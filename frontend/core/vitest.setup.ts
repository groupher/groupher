import '@testing-library/jest-dom/vitest'
import { createElement } from 'react'

import { setPlatformFallback, type TPlatform } from '~/platform'

const testPlatform: TPlatform = {
  components: {
    Image: ({ fill: _fill, priority: _priority, unoptimized: _unoptimized, ...props }) =>
      createElement('img', props),
    Link: ({ prefetch: _prefetch, replace: _replace, scroll: _scroll, ...props }) =>
      createElement('a', props),
    Script: ({ strategy: _strategy, ...props }) => createElement('script', props),
  },
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
    push: (href) => window.history.pushState(null, '', href),
    replace: (href) => window.history.replaceState(null, '', href),
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    refresh: vi.fn(),
    prefetch: async () => {},
    isActive: vi.fn(() => false),
  },
}

setPlatformFallback(testPlatform)

// `~/config` re-exports app runtime modules, which can pull in `next/server`.
// For unit tests that only need lightweight constants, stub the module.
vi.mock('~/config', () => {
  return {
    ASSETS_HUB_ENDPOINT: 'https://assets-hub.example.test',
    ASSETS_HUB_READ_ENDPOINT: 'https://assets.example.test',
    PAGE_SIZE: { D: 20 },
    SITE_URL: 'https://example.test',
    DASHBOARD_SITE_URL: 'https://dashboard.example.test',
  }
})
