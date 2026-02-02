import '@testing-library/jest-dom/vitest'

// `~/config` re-exports NextAuth handlers, which pull in `next/server`.
// For unit tests that only need lightweight constants, stub the module.
vi.mock('~/config', () => {
  return {
    PAGE_SIZE: { D: 20 },
    SITE_URL: 'https://example.test',
  }
})
