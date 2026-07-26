import { getAuthCookieNames } from '@groupher/frontend-core/auth-contract'
import type { NextAuthConfig } from 'next-auth'

type TOptions = {
  domain?: string
  secure: boolean
}

export const buildSharedAuthCookies = ({ domain, secure }: TOptions): NextAuthConfig['cookies'] => {
  if (!domain) return undefined

  const names = getAuthCookieNames(secure)
  const options = { domain }

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
