import { Auth, type AuthConfig, setEnvDefaults } from '@auth/core'
import GitHub from '@auth/core/providers/github'
import {
  GROUPHER_AUTH_TOKEN_COOKIE,
  getAuthCookieNames,
  getAuthSessionCookieName,
} from '@groupher/contracts/auth'
import { GROUPHER_SERVER_TRUST_HEADER } from '@groupher/contracts/headers'
import { serialize } from 'hono/utils/cookie'

import './env'
import { buildSharedAuthCookies } from '../cookie-config'
import { resolveAuthRedirect } from '../redirect-url'

const AUTH_BASE_PATH = '/api/auth'
const SESSION_MAX_AGE = 60 * 60 * 24 * 14
const PHOENIX_GRAPHQL_ENDPOINT =
  process.env.PHOENIX_GRAPHQL_ENDPOINT?.trim() || 'http://127.0.0.1:4001/graphiql'

const useSecureCookies =
  process.env.AUTH_COOKIE_SECURE === 'true' ||
  process.env.AUTH_URL?.startsWith('https://') ||
  process.env.NODE_ENV === 'production'

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

type TAuthDependencies = {
  onPhoenixToken?: (token: string) => void
  signinOauth?: (provider: Record<string, unknown>) => Promise<string>
}

type TAuthCore = (request: Request, config: AuthConfig) => Promise<Response>

type TAuthRequestDependencies = {
  authCore?: TAuthCore
  signinOauth?: TAuthDependencies['signinOauth']
}

export const signinOauth = async (provider: Record<string, unknown>): Promise<string> => {
  const serverTrustSecret = process.env.GROUPHER_SERVER_TRUST_SECRET?.trim()
  if (!serverTrustSecret) throw new Error('Groupher server trust is not configured.')

  const response = await fetch(PHOENIX_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [GROUPHER_SERVER_TRUST_HEADER]: serverTrustSecret,
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

export const buildAuthConfig = ({
  onPhoenixToken = () => undefined,
  signinOauth: exchangeIdentity = signinOauth,
}: TAuthDependencies = {}): AuthConfig => {
  const config = {
    basePath: AUTH_BASE_PATH,
    secret: process.env.NEXTAUTH_SECRET,
    trustHost: true,
    useSecureCookies,
    cookies: buildSharedAuthCookies({
      domain: process.env.AUTH_COOKIE_DOMAIN?.trim(),
      secure: useSecureCookies,
    }),
    session: {
      strategy: 'jwt',
      maxAge: SESSION_MAX_AGE,
    },
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

        onPhoenixToken(await exchangeIdentity(provider))
        return token
      },
    },
  } satisfies AuthConfig

  setEnvDefaults(process.env, config, true)
  return config
}

export const buildPhoenixTokenCookie = (token: string, maxAge = SESSION_MAX_AGE): string =>
  serialize(GROUPHER_AUTH_TOKEN_COOKIE, token, {
    domain: process.env.AUTH_COOKIE_DOMAIN?.trim(),
    httpOnly: true,
    maxAge,
    path: '/',
    sameSite: 'lax',
    secure: useSecureCookies,
  })

const buildExpiredCookie = (name: string): string =>
  serialize(name, '', {
    domain: process.env.AUTH_COOKIE_DOMAIN?.trim(),
    httpOnly: true,
    maxAge: 0,
    path: '/',
    sameSite: 'lax',
    secure: useSecureCookies,
  })

const getRequestCookieNames = (request: Request): string[] => {
  const cookie = request.headers.get('cookie')
  if (!cookie) return []

  return cookie
    .split(';')
    .map((part) => part.trim().split('=')[0])
    .filter((name): name is string => Boolean(name))
}

export const buildAuthCookieClearingHeaders = (request: Request): string[] => {
  const authCookies = getAuthCookieNames(useSecureCookies)
  const authCookieNames = Object.values(authCookies)
  const chunkableCookieNames = new Set([
    getAuthSessionCookieName(useSecureCookies),
    authCookies.csrfToken,
  ])
  const requestCookieNames = getRequestCookieNames(request)
  const cookiesToClear = new Set([
    GROUPHER_AUTH_TOKEN_COOKIE,
    ...authCookieNames,
    ...requestCookieNames.filter((name) =>
      authCookieNames.some(
        (authCookieName) =>
          name === authCookieName ||
          (chunkableCookieNames.has(authCookieName) && name.startsWith(`${authCookieName}.`)),
      ),
    ),
  ])

  return [...cookiesToClear].map(buildExpiredCookie)
}

export const toCanonicalAuthRequest = (request: Request): Request => {
  const authUrl = process.env.AUTH_URL?.trim()
  if (!authUrl) return request

  const canonicalOrigin = new URL(authUrl)
  const url = new URL(request.url)
  url.protocol = canonicalOrigin.protocol
  url.hostname = canonicalOrigin.hostname
  url.port = canonicalOrigin.port

  return new Request(url, request)
}

const appendPhoenixTokenCookie = (response: Response, token: string): Response => {
  const headers = new Headers(response.headers)
  headers.append('set-cookie', buildPhoenixTokenCookie(token))

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  })
}

const callAuthCore: TAuthCore = async (request, config) => (await Auth(request, config)) as Response

const issuedAuthSession = (response: Response): boolean => {
  const sessionCookie = getAuthSessionCookieName(useSecureCookies)
  const setCookie = response.headers.get('set-cookie') || ''

  return setCookie.includes(`${sessionCookie}=`) || setCookie.includes(`${sessionCookie}.0=`)
}

export const createAuthRequestHandler = ({
  authCore = callAuthCore,
  signinOauth: exchangeIdentity = signinOauth,
}: TAuthRequestDependencies = {}) => {
  return async (request: Request): Promise<Response> => {
    let phoenixToken: string | undefined
    const config = buildAuthConfig({
      onPhoenixToken: (token) => {
        phoenixToken = token
      },
      signinOauth: exchangeIdentity,
    })
    const response = await authCore(toCanonicalAuthRequest(request), config)

    return phoenixToken && issuedAuthSession(response)
      ? appendPhoenixTokenCookie(response, phoenixToken)
      : response
  }
}

export const handleAuthRequest = createAuthRequestHandler()
