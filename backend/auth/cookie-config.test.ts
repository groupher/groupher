import { describe, expect, it } from 'vitest'

import { buildSharedAuthCookies } from './cookie-config'

describe('buildSharedAuthCookies', () => {
  it('keeps Auth.js defaults when no shared domain is configured', () => {
    expect(buildSharedAuthCookies({ secure: true })).toBeUndefined()
  })

  it('shares secure OAuth and Session cookies across Groupher subdomains', () => {
    const cookies = buildSharedAuthCookies({
      domain: '.groupher.localhost',
      secure: true,
    })

    expect(cookies?.sessionToken?.name).toBe('__Secure-groupher-auth.session-token')
    expect(cookies?.csrfToken?.name).toBe('__Secure-groupher-auth.csrf-token')

    for (const cookie of Object.values(cookies || {})) {
      expect(cookie.options?.domain).toBe('.groupher.localhost')
    }
  })

  it('does not use secure prefixes for an HTTP environment', () => {
    const cookies = buildSharedAuthCookies({
      domain: '.groupher.localhost',
      secure: false,
    })

    expect(cookies?.sessionToken?.name).toBe('groupher-auth.session-token')
    expect(cookies?.csrfToken?.name).toBe('groupher-auth.csrf-token')
  })
})
