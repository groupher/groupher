/**
 * GitHub OAuth Link authorization and identity exchange.
 *
 * Browser -> Auth -> GitHub -> verified identity
 */
import { createHash } from 'node:crypto'

export const GITHUB_ENDPOINTS = {
  authorization: 'https://github.com/login/oauth/authorize',
  token: 'https://github.com/login/oauth/access_token',
  userinfo: 'https://api.github.com/user',
} as const

export type TVerifiedGithubIdentity = {
  provider: 'github'
  providerId: string
  login?: string
  nickname?: string
  avatar?: string
  email?: string
  bio?: string
  city?: string
  company?: string
}

/** Runs the github authorization url operation at the auth boundary. */
export const githubAuthorizationUrl = (
  state: string,
  redirectUri: string,
  codeVerifier: string,
): string => {
  const clientId = process.env.AUTH_GITHUB_ID?.trim()
  if (!clientId) throw new Error('GitHub OAuth is not configured.')

  const url = new URL(GITHUB_ENDPOINTS.authorization)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)
  url.searchParams.set(
    'code_challenge',
    createHash('sha256').update(codeVerifier).digest('base64url'),
  )
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('scope', 'read:user user:email')
  return url.toString()
}

/** Runs the exchange github code for identity operation at the auth boundary. */
export const exchangeGithubCodeForIdentity = async (
  code: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<TVerifiedGithubIdentity> => {
  const clientId = process.env.AUTH_GITHUB_ID?.trim()
  const clientSecret = process.env.AUTH_GITHUB_SECRET?.trim()
  if (!clientId || !clientSecret) throw new Error('GitHub OAuth is not configured.')

  const tokenResponse = await fetch(GITHUB_ENDPOINTS.token, {
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
    }),
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    method: 'POST',
  })
  if (!tokenResponse.ok) throw new Error('GitHub OAuth token exchange failed.')
  const tokenPayload = (await tokenResponse.json()) as { access_token?: unknown; error?: unknown }
  if (typeof tokenPayload.access_token !== 'string' || !tokenPayload.access_token) {
    throw new Error('GitHub OAuth token exchange failed.')
  }

  const profileResponse = await fetch(GITHUB_ENDPOINTS.userinfo, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${tokenPayload.access_token}`,
      'user-agent': 'groupher-auth',
    },
  })
  if (!profileResponse.ok) throw new Error('GitHub profile lookup failed.')
  const profile = (await profileResponse.json()) as Record<string, unknown>
  if (typeof profile.id !== 'number' && typeof profile.id !== 'string') {
    throw new Error('GitHub profile is invalid.')
  }

  const stringField = (key: string): string | undefined =>
    typeof profile[key] === 'string' && profile[key] ? (profile[key] as string) : undefined

  return {
    avatar: stringField('avatar_url'),
    bio: stringField('bio'),
    city: stringField('location'),
    company: stringField('company'),
    email: stringField('email'),
    login: stringField('login'),
    nickname: stringField('name'),
    provider: 'github',
    providerId: String(profile.id),
  }
}
