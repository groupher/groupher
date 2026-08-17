import { describe, expect, it } from 'vitest'

import { resolveAuthRedirect } from './redirect-url'

describe('resolveAuthRedirect', () => {
  const baseUrl = 'https://auth.groupher.localhost'
  const sharedDomain = '.groupher.localhost'

  it('preserves a Dashboard subdomain callback', () => {
    expect(
      resolveAuthRedirect({
        baseUrl,
        sharedDomain,
        url: 'https://dashboard.groupher.localhost/home',
      }),
    ).toBe('https://dashboard.groupher.localhost/home')
  })

  it('resolves a relative callback against the Auth base URL', () => {
    expect(resolveAuthRedirect({ baseUrl, sharedDomain, url: '/home' })).toBe(
      'https://auth.groupher.localhost/home',
    )
  })

  it('rejects an external lookalike domain', () => {
    expect(
      resolveAuthRedirect({
        baseUrl,
        sharedDomain,
        url: 'https://groupher.localhost.example.com/home',
      }),
    ).toBe(baseUrl)
  })

  it('rejects a callback that changes the protocol or port', () => {
    expect(
      resolveAuthRedirect({
        baseUrl,
        sharedDomain,
        url: 'http://dashboard.groupher.localhost/home',
      }),
    ).toBe(baseUrl)

    expect(
      resolveAuthRedirect({
        baseUrl,
        sharedDomain,
        url: 'https://dashboard.groupher.localhost:444/home',
      }),
    ).toBe(baseUrl)
  })
})
