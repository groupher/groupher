import type { NextAuthConfig } from 'next-auth'
import NextAuth from 'next-auth'
import GitHub from 'next-auth/providers/github'

import { buildSharedAuthCookies } from './cookie-config'
import { resolveAuthRedirect } from './redirect-url'

const PHOENIX_TOKEN_KEY = 'auth.token'
const SERVER_TRUST_HEADER = 'x-groupher-server-trust'
const PHOENIX_GRAPHQL_ENDPOINT =
  process.env.PHOENIX_GRAPHQL_ENDPOINT?.trim() || 'http://127.0.0.1:4001/graphiql'
const useSecureCookies =
  process.env.AUTH_COOKIE_SECURE === 'true' ||
  process.env.AUTH_URL?.startsWith('https://') ||
  process.env.NODE_ENV === 'production'
const cookies = buildSharedAuthCookies({
  domain: process.env.AUTH_COOKIE_DOMAIN?.trim(),
  secure: useSecureCookies,
})

const SIGNIN_OAUTH_MUTATION = `
  mutation SigninOauth($provider: OauthProviderInput!) {
    signinOauth(provider: $provider) {
      token
    }
  }
`

type TSigninOauthResponse = {
  data?: {
    signinOauth?: {
      token?: unknown
    } | null
  }
  errors?: Array<{
    message?: string
  }>
}

const signinOauth = async (provider: Record<string, unknown>): Promise<string> => {
  const serverTrustSecret = process.env.GROUPHER_SERVER_TRUST_SECRET?.trim()
  if (!serverTrustSecret) throw new Error('Groupher server trust is not configured.')

  const response = await fetch(PHOENIX_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [SERVER_TRUST_HEADER]: serverTrustSecret,
    },
    body: JSON.stringify({
      query: SIGNIN_OAUTH_MUTATION,
      variables: { provider },
    }),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Phoenix OAuth request failed with status ${response.status}.`)
  }

  const payload = (await response.json()) as TSigninOauthResponse
  if (payload.errors?.length) {
    throw new Error(payload.errors[0]?.message || 'Phoenix OAuth request failed.')
  }

  const token = payload.data?.signinOauth?.token
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('Phoenix OAuth request returned an invalid token.')
  }

  return token
}

const config = {
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  useSecureCookies,
  cookies,
  providers: [GitHub],
  callbacks: {
    async redirect({ url, baseUrl }) {
      return resolveAuthRedirect({
        url,
        baseUrl,
        sharedDomain: process.env.AUTH_COOKIE_DOMAIN,
      })
    },
    async jwt({ token, account, profile }) {
      if (!account || !profile) return token

      const githubProfile = profile as typeof profile & {
        avatar_url?: string
        bio?: string
        company?: string
        location?: string
        login?: string
      }
      const provider = {
        provider: account.provider,
        providerId: account.providerAccountId,
        login: githubProfile.login,
        nickname: githubProfile.name,
        avatar: githubProfile.avatar_url,
        bio: githubProfile.bio,
        country: '',
        city: githubProfile.location,
        company: githubProfile.company,
        raw: JSON.stringify(profile),
      }

      token[PHOENIX_TOKEN_KEY] = await signinOauth(provider)
      return token
    },
  },
} satisfies NextAuthConfig

export const { handlers } = NextAuth(config)
