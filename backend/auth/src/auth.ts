import { Auth, type AuthConfig, setEnvDefaults } from '@auth/core'
import GitHub from '@auth/core/providers/github'
import {
  GROUPHER_AUTH_SIGNED_IN_COOKIE,
  GROUPHER_AUTH_TOKEN_COOKIE,
  getAuthCookieNames,
  getAuthSessionCookieName,
} from '@groupher/contracts/auth'
import { GROUPHER_SERVER_TRUST_HEADER } from '@groupher/contracts/headers'
import { serialize } from 'hono/utils/cookie'

import './env'
import { buildHostOnlyAuthCookies } from '../cookie-config'
import { resolveAuthRedirect } from '../redirect-url'

const AUTH_BASE_PATH = '/api/auth'
export const ACCESS_TOKEN_MAX_AGE = 60 * 30
export const BROWSER_SESSION_MAX_AGE = 60 * 60 * 24 * 90
const PHOENIX_GRAPHQL_ENDPOINT =
  process.env.PHOENIX_GRAPHQL_ENDPOINT?.trim() || 'http://127.0.0.1:4001/graphiql'

const useSecureCookies =
  process.env.AUTH_COOKIE_SECURE === 'true' ||
  process.env.AUTH_URL?.startsWith('https://') ||
  process.env.NODE_ENV === 'production'

const SIGNIN_OAUTH_MUTATION = `
  mutation SigninOauth($provider: OauthProviderInput!, $browserSession: BrowserSessionMetadataInput) {
    signinOauth(provider: $provider, browserSession: $browserSession) {
      accessToken
      accessExpiresAt
      browserSessionRef
      sessionAbsoluteExpiresAt
    }
  }
`

export type TBrowserSigninResult = {
  accessExpiresAt: string
  accessToken: string
  browserSessionRef: string
  sessionAbsoluteExpiresAt: string
}

type TBrowserSessionMetadata = {
  userAgentSummary?: string
}

type TSigninOauthResponse = {
  data?: {
    signinOauth?: Partial<TBrowserSigninResult> | null
  }
  errors?: Array<{
    extensions?: { code?: unknown }
    message?: string
  }>
}

export class PhoenixBrowserSessionError extends Error {
  readonly code?: string
  readonly upstreamStatus?: number

  constructor(message: string, options: { code?: string; upstreamStatus?: number } = {}) {
    super(message)
    this.name = 'PhoenixBrowserSessionError'
    this.code = options.code
    this.upstreamStatus = options.upstreamStatus
  }
}

type TAuthDependencies = {
  onPhoenixSignin?: (result: TBrowserSigninResult) => void
  onSessionToken?: (token: Record<string, unknown>) => void
  signinOauth?: (
    provider: Record<string, unknown>,
    metadata?: TBrowserSessionMetadata,
  ) => Promise<TBrowserSigninResult>
}

type TAuthCore = (request: Request, config: AuthConfig) => Promise<Response>

type TAuthRequestDependencies = {
  authCore?: TAuthCore
  signinOauth?: TAuthDependencies['signinOauth']
}

export type TBrowserAuthSession = {
  browserSessionRef: string
  sessionAbsoluteExpiresAt: string
}

export type TBrowserSessionSummary = {
  browserFamily?: string | null
  createdCity?: string | null
  createdCountry?: string | null
  createdRegion?: string | null
  deviceFamily?: string | null
  insertedAt?: string | null
  isCurrent: boolean
  lastSeenCity?: string | null
  lastSeenCountry?: string | null
  lastSeenAt?: string | null
  lastSeenRegion?: string | null
  osFamily?: string | null
  publicRef: string
  status?: string | null
  userAgentSummary?: string | null
}

export const signinOauth = async (
  provider: Record<string, unknown>,
  browserSession: TBrowserSessionMetadata = {},
): Promise<TBrowserSigninResult> => {
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
      variables: { browserSession, provider },
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

  const result = payload.data?.signinOauth
  if (
    !result ||
    typeof result.accessToken !== 'string' ||
    typeof result.accessExpiresAt !== 'string' ||
    typeof result.browserSessionRef !== 'string' ||
    typeof result.sessionAbsoluteExpiresAt !== 'string'
  ) {
    throw new Error('Phoenix OAuth request returned an invalid browser session.')
  }

  return result as TBrowserSigninResult
}

export const buildAuthConfig = ({
  onPhoenixSignin = () => undefined,
  onSessionToken = () => undefined,
  signinOauth: exchangeIdentity = signinOauth,
}: TAuthDependencies = {}): AuthConfig => {
  const config = {
    basePath: AUTH_BASE_PATH,
    secret: process.env.NEXTAUTH_SECRET,
    trustHost: true,
    useSecureCookies,
    cookies: buildHostOnlyAuthCookies({ secure: useSecureCookies }),
    session: {
      strategy: 'jwt',
      maxAge: BROWSER_SESSION_MAX_AGE,
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

        const browserSession = await exchangeIdentity(provider)
        onPhoenixSignin(browserSession)

        return {
          ...token,
          browserSessionRef: browserSession.browserSessionRef,
          sessionAbsoluteExpiresAt: browserSession.sessionAbsoluteExpiresAt,
        }
      },
      async session({ session, token }) {
        onSessionToken(token)
        return session
      },
    },
  } satisfies AuthConfig

  setEnvDefaults(process.env, config, true)
  return config
}

export const buildPhoenixTokenCookie = (token: string, maxAge = ACCESS_TOKEN_MAX_AGE): string =>
  serialize(GROUPHER_AUTH_TOKEN_COOKIE, token, {
    domain: process.env.AUTH_COOKIE_DOMAIN?.trim(),
    httpOnly: true,
    maxAge,
    path: '/',
    sameSite: 'lax',
    secure: useSecureCookies,
  })

/**
 * Builds a non-sensitive browser-readable login hint.
 *
 * The frontend cannot read `GROUPHER_AUTH_TOKEN_COOKIE` because it is HttpOnly,
 * and reading cookies from Next.js layouts would make the route dynamic on
 * Vercel. This hint lets client code decide whether to call `me` without
 * exposing the actual Phoenix token or changing route caching behavior.
 *
 * @example
 * response.headers.append('set-cookie', buildSignedInHintCookie())
 */
export const buildSignedInHintCookie = (maxAge = BROWSER_SESSION_MAX_AGE): string =>
  serialize(GROUPHER_AUTH_SIGNED_IN_COOKIE, '1', {
    domain: process.env.AUTH_COOKIE_DOMAIN?.trim(),
    httpOnly: false,
    maxAge,
    path: '/',
    sameSite: 'lax',
    secure: useSecureCookies,
  })

// Auth.js may split session/csrf cookies into chunks. Clearing uses the current
// request cookie names as a fallback so logout also removes chunked variants.
const buildExpiredCookie = (name: string, domain?: string, httpOnly = true): string =>
  serialize(name, '', {
    ...(domain ? { domain } : {}),
    httpOnly,
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
    GROUPHER_AUTH_SIGNED_IN_COOKIE,
    ...authCookieNames,
    ...requestCookieNames.filter((name) =>
      authCookieNames.some(
        (authCookieName) =>
          name === authCookieName ||
          (chunkableCookieNames.has(authCookieName) && name.startsWith(`${authCookieName}.`)),
      ),
    ),
  ])

  const cookieDomain = process.env.AUTH_COOKIE_DOMAIN?.trim()
  return [...cookiesToClear].map((name) =>
    name === GROUPHER_AUTH_TOKEN_COOKIE
      ? buildExpiredCookie(name, cookieDomain)
      : name === GROUPHER_AUTH_SIGNED_IN_COOKIE
        ? buildExpiredCookie(name, cookieDomain, false)
        : buildExpiredCookie(name),
  )
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

const maxAgeUntil = (expiresAt: string, maximum: number): number => {
  const expiresAtMs = Date.parse(expiresAt)
  if (Number.isNaN(expiresAtMs)) throw new Error('Phoenix returned an invalid access expiry.')

  return Math.max(0, Math.min(maximum, Math.floor((expiresAtMs - Date.now()) / 1000)))
}

export const appendPhoenixTokenCookie = (
  response: Response,
  result: TBrowserSigninResult,
): Response => {
  const headers = new Headers(response.headers)
  const accessMaxAge = maxAgeUntil(result.accessExpiresAt, ACCESS_TOKEN_MAX_AGE)
  const sessionMaxAge = maxAgeUntil(result.sessionAbsoluteExpiresAt, BROWSER_SESSION_MAX_AGE)
  headers.append('set-cookie', buildPhoenixTokenCookie(result.accessToken, accessMaxAge))
  headers.append('set-cookie', buildSignedInHintCookie(sessionMaxAge))

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  })
}

const callAuthCore: TAuthCore = async (request, config) => (await Auth(request, config)) as Response

const sessionProbeRequest = (request: Request): Request => {
  const url = new URL(request.url)
  url.pathname = `${AUTH_BASE_PATH}/session`
  url.search = ''
  return new Request(url, { headers: request.headers, method: 'GET' })
}

/** Reads the protected Auth.js JWT without returning it to product applications. */
export const readBrowserSession = async (
  request: Request,
  authCore: TAuthCore = callAuthCore,
): Promise<TBrowserAuthSession | null> => {
  let sessionToken: Record<string, unknown> | undefined
  const response = await authCore(
    toCanonicalAuthRequest(sessionProbeRequest(request)),
    buildAuthConfig({
      onSessionToken: (token) => {
        sessionToken = token
      },
    }),
  )

  if (!response.ok || !sessionToken) return null

  const browserSessionRef = sessionToken.browserSessionRef
  const sessionAbsoluteExpiresAt = sessionToken.sessionAbsoluteExpiresAt
  if (typeof browserSessionRef !== 'string' || typeof sessionAbsoluteExpiresAt !== 'string')
    return null
  if (Date.parse(sessionAbsoluteExpiresAt) <= Date.now()) return null

  return { browserSessionRef, sessionAbsoluteExpiresAt }
}

const REFRESH_BROWSER_SESSION_MUTATION = `
  mutation RefreshBrowserSession($browserSessionRef: String!) {
    refreshBrowserSession(browserSessionRef: $browserSessionRef) {
      accessToken
      accessExpiresAt
      browserSessionRef
      sessionAbsoluteExpiresAt
    }
  }
`

const REVOKE_BROWSER_SESSION_MUTATION = `
  mutation RevokeBrowserSession($browserSessionRef: String!) {
    revokeBrowserSession(browserSessionRef: $browserSessionRef) {
      done
    }
  }
`

const LIST_BROWSER_SESSIONS_QUERY = `
  query BrowserSessions($browserSessionRef: String!) {
    browserSessions(browserSessionRef: $browserSessionRef) {
      browserFamily
      createdCity
      createdCountry
      createdRegion
      deviceFamily
      insertedAt
      isCurrent
      lastSeenCity
      lastSeenCountry
      lastSeenAt
      lastSeenRegion
      osFamily
      publicRef
      status
      userAgentSummary
    }
  }
`

const REVOKE_BROWSER_SESSION_PUBLIC_MUTATION = `
  mutation RevokeBrowserSessionPublic($browserSessionRef: String!, $publicRef: String!) {
    revokeBrowserSessionPublic(browserSessionRef: $browserSessionRef, publicRef: $publicRef) { done }
  }
`

const REVOKE_OTHER_BROWSER_SESSIONS_MUTATION = `
  mutation RevokeOtherBrowserSessions($browserSessionRef: String!) {
    revokeOtherBrowserSessions(browserSessionRef: $browserSessionRef) { done }
  }
`

const callPhoenix = async <TData>(
  query: string,
  variables: Record<string, unknown>,
): Promise<TData> => {
  const serverTrustSecret = process.env.GROUPHER_SERVER_TRUST_SECRET?.trim()
  if (!serverTrustSecret) throw new Error('Groupher server trust is not configured.')

  const response = await fetch(PHOENIX_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [GROUPHER_SERVER_TRUST_HEADER]: serverTrustSecret,
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new PhoenixBrowserSessionError(
      `Phoenix browser-session request failed with status ${response.status}.`,
      { upstreamStatus: response.status },
    )
  }

  const payload = (await response.json()) as {
    data?: TData
    errors?: Array<{ extensions?: { code?: unknown }; message?: string }>
  }
  if (payload.errors?.length || !payload.data) {
    const error = payload.errors?.[0]
    throw new PhoenixBrowserSessionError(
      error?.message || 'Phoenix browser-session request failed.',
      {
        code: typeof error?.extensions?.code === 'string' ? error.extensions.code : undefined,
      },
    )
  }

  return payload.data
}

export const refreshBrowserSession = async (ref: string): Promise<TBrowserSigninResult> => {
  const data = await callPhoenix<{ refreshBrowserSession?: Partial<TBrowserSigninResult> }>(
    REFRESH_BROWSER_SESSION_MUTATION,
    { browserSessionRef: ref },
  )
  const result = data.refreshBrowserSession
  if (
    !result ||
    typeof result.accessToken !== 'string' ||
    typeof result.accessExpiresAt !== 'string' ||
    typeof result.browserSessionRef !== 'string' ||
    typeof result.sessionAbsoluteExpiresAt !== 'string'
  ) {
    throw new Error('Phoenix refresh returned an invalid browser session.')
  }
  return result as TBrowserSigninResult
}

export const revokeBrowserSession = async (ref: string): Promise<void> => {
  const data = await callPhoenix<{ revokeBrowserSession?: { done?: unknown } }>(
    REVOKE_BROWSER_SESSION_MUTATION,
    { browserSessionRef: ref },
  )
  if (data.revokeBrowserSession?.done !== true)
    throw new Error('Phoenix did not revoke the browser session.')
}

export const listBrowserSessions = async (ref: string): Promise<TBrowserSessionSummary[]> => {
  const data = await callPhoenix<{ browserSessions?: unknown }>(LIST_BROWSER_SESSIONS_QUERY, {
    browserSessionRef: ref,
  })
  if (!Array.isArray(data.browserSessions))
    throw new Error('Phoenix returned invalid browser sessions.')
  return data.browserSessions as TBrowserSessionSummary[]
}

export const revokeBrowserSessionPublic = async (ref: string, publicRef: string): Promise<void> => {
  const data = await callPhoenix<{ revokeBrowserSessionPublic?: { done?: unknown } }>(
    REVOKE_BROWSER_SESSION_PUBLIC_MUTATION,
    { browserSessionRef: ref, publicRef },
  )
  if (data.revokeBrowserSessionPublic?.done !== true)
    throw new Error('Phoenix did not revoke the browser session.')
}

export const revokeOtherBrowserSessions = async (ref: string): Promise<void> => {
  const data = await callPhoenix<{ revokeOtherBrowserSessions?: { done?: unknown } }>(
    REVOKE_OTHER_BROWSER_SESSIONS_MUTATION,
    { browserSessionRef: ref },
  )
  if (data.revokeOtherBrowserSessions?.done !== true)
    throw new Error('Phoenix did not revoke other browser sessions.')
}

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
    let browserSession: TBrowserSigninResult | undefined
    const config = buildAuthConfig({
      onPhoenixSignin: (result) => {
        browserSession = result
      },
      signinOauth: (provider) =>
        exchangeIdentity(provider, {
          userAgentSummary: request.headers.get('user-agent')?.slice(0, 512) || undefined,
        }),
    })
    const response = await authCore(toCanonicalAuthRequest(request), config)

    return browserSession && issuedAuthSession(response)
      ? appendPhoenixTokenCookie(response, browserSession)
      : response
  }
}

export const handleAuthRequest = createAuthRequestHandler()
