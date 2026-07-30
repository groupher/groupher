import '@testing-library/jest-dom/vitest'

// `~/config` re-exports app runtime modules, which can pull in `next/server`.
// For unit tests that only need lightweight constants, stub the module.
vi.mock('~/config', () => {
  return {
    ASSETS_HUB_ENDPOINT: 'https://assets-hub.example.test',
    ASSETS_HUB_READ_ENDPOINT: 'https://assets.example.test',
    PAGE_SIZE: { D: 20 },
    SITE_URL: 'https://example.test',
  }
})
