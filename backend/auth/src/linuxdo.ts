/**
 * Maps Linux DO Connect identities and performs OAuth authorization and exchange.
 *
 * Browser -> Connect -> Auth -> Phoenix account identity
 */
import { createHash } from 'node:crypto'

import type { OAuthConfig } from '@auth/core/providers'

export const LINUXDO_ENDPOINTS = {
  authorization: 'https://connect.linux.do/oauth2/authorize',
  token: 'https://connect.linux.do/oauth2/token',
  userinfo: 'https://connect.linux.do/api/user',
} as const

type TLinuxDoProfile = {
  id: number | string
  username?: string
  name?: string
  avatar_template?: string
}

/** Maps the verified Linux DO profile to the fields used by Accounts. */
export const linuxDoIdentity = (profile: TLinuxDoProfile) => {
  if (
    (typeof profile.id !== 'string' && typeof profile.id !== 'number') ||
    String(profile.id).trim() === ''
  ) {
    throw new Error('Linux DO profile has no id.')
  }
  const id = String(profile.id)

  let avatar: string | undefined
  if (profile.avatar_template) {
    const candidate = profile.avatar_template.replace('{size}', '120')
    try {
      const url = new URL(candidate, 'https://linux.do')
      if (
        url.protocol === 'https:' &&
        (url.hostname === 'linux.do' || url.hostname.endsWith('.linux.do'))
      ) {
        avatar = url.toString()
      }
    } catch {
      // Invalid avatar metadata does not prevent authentication.
    }
  }

  return {
    provider: 'linuxdo',
    providerId: id,
    login: profile.username,
    nickname: profile.name,
    avatar,
  }
}

/** Auth.js configuration for Linux DO Connect. */
export const linuxDoProvider = (): OAuthConfig<TLinuxDoProfile> => ({
  id: 'linuxdo',
  name: 'Linux DO',
  type: 'oauth',
  issuer: 'https://connect.linux.do/',
  clientId: process.env.AUTH_LINUXDO_ID,
  clientSecret: process.env.AUTH_LINUXDO_SECRET,
  authorization: {
    url: LINUXDO_ENDPOINTS.authorization,
    params: { scope: 'openid profile' },
  },
  token: LINUXDO_ENDPOINTS.token,
  userinfo: LINUXDO_ENDPOINTS.userinfo,
  checks: ['pkce', 'state'],
  profile(profile) {
    const identity = linuxDoIdentity(profile)
    return {
      id: identity.providerId,
      name: identity.nickname || identity.login,
      image: identity.avatar,
    }
  },
})

/** Builds the Connect authorization request for a link flow. */
export const linuxDoAuthorizationUrl = (
  state: string,
  redirectUri: string,
  verifier: string,
): string => {
  const clientId = process.env.AUTH_LINUXDO_ID?.trim()
  if (!clientId) throw new Error('Linux DO OAuth is not configured.')
  const url = new URL(LINUXDO_ENDPOINTS.authorization)
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile',
    state,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
  }).toString()
  return url.toString()
}

/** Exchanges a one-time code and maps the verified Connect identity. */
export const exchangeLinuxDoCodeForIdentity = async (
  code: string,
  redirectUri: string,
  verifier: string,
) => {
  const clientId = process.env.AUTH_LINUXDO_ID?.trim()
  const secret = process.env.AUTH_LINUXDO_SECRET?.trim()
  if (!clientId || !secret) throw new Error('Linux DO OAuth is not configured.')
  const response = await fetch(LINUXDO_ENDPOINTS.token, {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  })
  if (!response.ok) throw new Error('Linux DO token exchange failed.')
  const tokens = (await response.json()) as { access_token?: unknown }
  if (typeof tokens.access_token !== 'string' || !tokens.access_token)
    throw new Error('Linux DO token exchange failed.')
  const user = await fetch(LINUXDO_ENDPOINTS.userinfo, {
    headers: { authorization: `Bearer ${tokens.access_token}`, accept: 'application/json' },
  })
  if (!user.ok) throw new Error('Linux DO profile lookup failed.')
  return linuxDoIdentity((await user.json()) as TLinuxDoProfile)
}
