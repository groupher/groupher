import { describe, expect, it } from 'vitest'

import {
  GROUPHER_AUTH_SIGNED_IN_COOKIE,
  GROUPHER_AUTH_TOKEN_COOKIE,
  getAuthCookieNames,
  getAuthSessionCookieName,
} from './auth'

describe('Auth cookie contract', () => {
  it('uses host-only Cookie names for secure Auth Session and OAuth state', () => {
    expect(getAuthCookieNames(true)).toEqual({
      callbackUrl: '__Host-groupher-auth.callback-url',
      csrfToken: '__Host-groupher-auth.csrf-token',
      nonce: '__Host-groupher-auth.nonce',
      pkceCodeVerifier: '__Host-groupher-auth.pkce.code_verifier',
      sessionToken: '__Host-groupher-auth.session-token',
      state: '__Host-groupher-auth.state',
      webauthnChallenge: '__Host-groupher-auth.challenge',
    })
  })

  it('keeps HTTP development cookies unprefixed', () => {
    expect(getAuthSessionCookieName(false)).toBe('groupher-auth.session-token')
  })

  it('uses the canonical Groupher auth token cookie', () => {
    expect(GROUPHER_AUTH_TOKEN_COOKIE).toBe('groupher-auth.token')
  })

  it('uses a non-sensitive signed-in hint cookie', () => {
    expect(GROUPHER_AUTH_SIGNED_IN_COOKIE).toBe('groupher-auth.signed-in')
  })
})
