/**
 * Implements the Cookie Config boundary inside Auth.
 *
 * Business position:
 *
 *   Browser / Gateway
 *     -> Auth module
 *     -> OAuth provider / Phoenix Accounts
 *     -> Session cookies or service token
 */

import type { AuthConfig } from '@auth/core'
import { getAuthCookieNames } from '@groupher/contracts/auth'

type TOptions = {
  secure: boolean
}

/**
 * Keep Auth.js Session and OAuth protocol cookies host-only on canonical Auth.
 * The shared parent domain is reserved for the short-lived Phoenix access
 * cookie written by Auth after a completed sign-in or refresh.
 */
export const buildHostOnlyAuthCookies = ({ secure }: TOptions): AuthConfig['cookies'] => {
  const names = getAuthCookieNames(secure)
  const options = {
    httpOnly: true,
    path: '/',
    sameSite: 'lax' as const,
    secure,
  }

  return {
    sessionToken: {
      name: names.sessionToken,
      options,
    },
    callbackUrl: {
      name: names.callbackUrl,
      options,
    },
    csrfToken: {
      name: names.csrfToken,
      options,
    },
    pkceCodeVerifier: {
      name: names.pkceCodeVerifier,
      options,
    },
    state: {
      name: names.state,
      options,
    },
    nonce: {
      name: names.nonce,
      options,
    },
    webauthnChallenge: {
      name: names.webauthnChallenge,
      options,
    },
  }
}
