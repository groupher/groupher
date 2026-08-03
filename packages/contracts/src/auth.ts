const AUTH_COOKIE_BASENAME = {
  callbackUrl: 'groupher-auth.callback-url',
  csrfToken: 'groupher-auth.csrf-token',
  nonce: 'groupher-auth.nonce',
  pkceCodeVerifier: 'groupher-auth.pkce.code_verifier',
  sessionToken: 'groupher-auth.session-token',
  state: 'groupher-auth.state',
  webauthnChallenge: 'groupher-auth.challenge',
} as const

export const GROUPHER_AUTH_TOKEN_COOKIE = 'groupher-auth.token'
/**
 * Readable browser hint that tells frontend account stores they may probe
 * the current session with `me`.
 *
 * This cookie is intentionally not an auth credential. The Phoenix token stays
 * in `GROUPHER_AUTH_TOKEN_COOKIE` as HttpOnly, and API requests are still
 * authenticated by the server-side GraphQL proxy.
 *
 * @example
 * document.cookie.includes(`${GROUPHER_AUTH_SIGNED_IN_COOKIE}=1`)
 */
export const GROUPHER_AUTH_SIGNED_IN_COOKIE = 'groupher-auth.signed-in'

export const getAuthCookieNames = (secure: boolean) => {
  const prefix = secure ? '__Secure-' : ''

  return {
    callbackUrl: `${prefix}${AUTH_COOKIE_BASENAME.callbackUrl}`,
    csrfToken: `${prefix}${AUTH_COOKIE_BASENAME.csrfToken}`,
    nonce: `${prefix}${AUTH_COOKIE_BASENAME.nonce}`,
    pkceCodeVerifier: `${prefix}${AUTH_COOKIE_BASENAME.pkceCodeVerifier}`,
    sessionToken: `${prefix}${AUTH_COOKIE_BASENAME.sessionToken}`,
    state: `${prefix}${AUTH_COOKIE_BASENAME.state}`,
    webauthnChallenge: `${prefix}${AUTH_COOKIE_BASENAME.webauthnChallenge}`,
  }
}

export const getAuthSessionCookieName = (secure: boolean): string =>
  getAuthCookieNames(secure).sessionToken
