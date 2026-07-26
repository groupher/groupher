import { describe, expect, it } from 'vitest'

import {
  GROUPHER_AUTH_TOKEN_COOKIE,
  getAuthCookieNames,
  getAuthSessionCookieName,
} from './auth-contract'

describe('Auth cookie contract', () => {
  it('uses a Groupher-specific namespace for secure shared cookies', () => {
    expect(getAuthCookieNames(true)).toEqual({
      callbackUrl: '__Secure-groupher-auth.callback-url',
      csrfToken: '__Secure-groupher-auth.csrf-token',
      nonce: '__Secure-groupher-auth.nonce',
      pkceCodeVerifier: '__Secure-groupher-auth.pkce.code_verifier',
      sessionToken: '__Secure-groupher-auth.session-token',
      state: '__Secure-groupher-auth.state',
      webauthnChallenge: '__Secure-groupher-auth.challenge',
    })
  })

  it('keeps HTTP development cookies unprefixed', () => {
    expect(getAuthSessionCookieName(false)).toBe('groupher-auth.session-token')
  })

  it('uses the canonical Groupher auth token cookie', () => {
    expect(GROUPHER_AUTH_TOKEN_COOKIE).toBe('groupher-auth.token')
  })
})
