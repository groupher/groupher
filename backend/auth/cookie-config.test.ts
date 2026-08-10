import { describe, expect, it } from 'vitest'

import { buildHostOnlyAuthCookies } from './cookie-config'

describe('buildHostOnlyAuthCookies', () => {
  it('keeps secure OAuth and Session cookies host-only on canonical Auth', () => {
    const cookies = buildHostOnlyAuthCookies({ secure: true })

    expect(cookies?.sessionToken?.name).toBe('__Host-groupher-auth.session-token')
    expect(cookies?.csrfToken?.name).toBe('__Host-groupher-auth.csrf-token')

    for (const cookie of Object.values(cookies || {})) {
      expect(cookie.options?.domain).toBeUndefined()
      expect(cookie.options?.path).toBe('/')
      expect(cookie.options?.secure).toBe(true)
    }
  })

  it('does not use secure prefixes for an HTTP environment', () => {
    const cookies = buildHostOnlyAuthCookies({ secure: false })

    expect(cookies?.sessionToken?.name).toBe('groupher-auth.session-token')
    expect(cookies?.csrfToken?.name).toBe('groupher-auth.csrf-token')
  })
})
