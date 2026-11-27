/**
 * Adapts Auth.js and OAuth provider callbacks to Groupher Session creation.
 *
 * Business position:
 *
 *   Browser / Gateway
 *     -> Auth session adapter
 *     -> OAuth provider / Phoenix Accounts
 *     -> Session cookies or service token
 */
import { randomBytes } from 'node:crypto'

import { Auth, type AuthConfig, setEnvDefaults } from '@auth/core'
import { encode } from '@auth/core/jwt'
import {
  AUTH_ERROR,
  GROUPHER_AUTH_SIGNED_IN_COOKIE,
  GROUPHER_AUTH_TOKEN_COOKIE,
  getAuthCookieNames,
  getAuthSessionCookieName,
} from '@groupher/contracts/auth'
import { GROUPHER_USER_AUTHORIZATION_HEADER } from '@groupher/contracts/headers'
import type { PagiInput, PagiPage } from '@groupher/contracts/pagination'
import { createServiceAuthClientFromEnv, type TServiceAuthClient } from '@groupher/service/auth'
import { serialize } from 'hono/utils/cookie'

import { buildHostOnlyAuthCookies } from '../cookie-config'
import { resolveAuthRedirect } from '../redirect-url'
import { resolvePhoenixGraphqlEndpoint } from './env'
import { OAUTH_PROVIDERS, oauthProvider } from './oauth-providers'
import { issueServiceToken } from './service-auth'

const AUTH_BASE_PATH = '/api/auth'
export const ACCESS_TOKEN_MAX_AGE = 60 * 30
export const BROWSER_SESSION_MAX_AGE = 60 * 60 * 24 * 90
export const BROWSER_SESSION_USER_AGENT_MAX_LENGTH = 255
const PHOENIX_GRAPHQL_ENDPOINT = resolvePhoenixGraphqlEndpoint(process.env)
const PHOENIX_AUTH_RESOURCE = 'https://api.groupher.com/auth'
let serviceTokenProvider: TServiceAuthClient | undefined

// Auth owns the issuer. Calling its public hostname from this Worker bypasses
// the route and can reach an unavailable origin; keep the credential checks local.
const issueLocalServiceToken: typeof fetch = async (input, init) => {
  const result = await issueServiceToken(new Request(input, init), process.env)
  return Response.json(result, { status: 'error' in result ? result.status : 200 })
}

const authServiceToken = (scope: string) => {
  const tokenFetcher = process.env.E2E_AUTH_STACK === '1' ? fetch : issueLocalServiceToken
  serviceTokenProvider ??= createServiceAuthClientFromEnv(process.env, tokenFetcher)
  return serviceTokenProvider.getToken({ resource: PHOENIX_AUTH_RESOURCE, scopes: [scope] })
}

export const useSecureCookies =
  process.env.AUTH_COOKIE_SECURE === 'true' ||
  process.env.AUTH_URL?.startsWith('https://') ||
  process.env.NODE_ENV === 'production'

const SIGNIN_OAUTH_MUTATION = `
  "Sign in with an OAuth provider and return token info."
  mutation SigninOauth($provider: OauthProviderInput!, $browserSession: BrowserSessionMetadataInput, $flowRef: String!, $returnTo: String) {
    signinOauth(provider: $provider, browserSession: $browserSession, flowRef: $flowRef, returnTo: $returnTo) {
      status
      registration { suggestedLogin }
      session { accessToken accessExpiresAt browserSessionRef sessionAbsoluteExpiresAt }
    }
  }
`

export type TBrowserSigninResult = {
  accessExpiresAt: string
  accessToken: string
  browserSessionRef: string
  sessionAbsoluteExpiresAt: string
}

const LEGACY_PHOENIX_ERROR_CODES = new Map<number, string>([
  [4018, AUTH_ERROR.SERVICE_TOKEN_INVALID],
  [4019, AUTH_ERROR.SERVICE_TOKEN_INVALID],
  [4020, AUTH_ERROR.SERVICE_TOKEN_INVALID],
  [4021, AUTH_ERROR.SERVICE_JWKS_UNAVAILABLE],
  [4022, AUTH_ERROR.SERVICE_TOKEN_INVALID],
])

/** Normalizes only legacy Phoenix codes whose public Auth meaning is unambiguous. */
export const normalizePhoenixErrorCode = (code: unknown): string | undefined => {
  if (typeof code === 'string') return code
  if (typeof code !== 'number' || !Number.isSafeInteger(code)) return undefined
  if (code >= 4200 && code <= 4214) return `PAGI_${code}`
  return LEGACY_PHOENIX_ERROR_CODES.get(code)
}

type TBrowserSessionMetadata = {
  userAgentSummary?: string
}

type TSigninOauthResponse = {
  data?: {
    signinOauth?: {
      status?: string
      session?: Partial<TBrowserSigninResult> | null
      registration?: { suggestedLogin?: string | null } | null
    } | null
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
    returnTo?: string,
  ) => Promise<TBrowserSigninResult>
}

type TAuthCore = (request: Request, config: AuthConfig) => Promise<Response>

type TAuthRequestDependencies = {
  authCore?: TAuthCore
  signinOauth?: TAuthDependencies['signinOauth']
  revokeBrowserSession?: (ref: string) => Promise<void>
  providers?: AuthConfig['providers']
  resolveRedirect?: typeof resolveAuthRedirect
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

export type TLinkedOauthAccount = {
  publicRef: string
  provider: string
  login?: string | null
  nickname?: string | null
  avatar?: string | null
  canUnlink: boolean
  linkedAt: string
}

/** Signals that a verified identity needs a user-selected login. */
export class OauthRegistrationRequired extends Error {
  constructor(
    readonly flowRef: string,
    readonly suggestedLogin: string | null,
  ) {
    super('OAuth registration requires a login.')
  }
}

/** Resolves a verified identity into a session or a registration flow. */
export const signinOauth = async (
  provider: Record<string, unknown>,
  browserSession: TBrowserSessionMetadata = {},
  returnTo?: string,
): Promise<TBrowserSigninResult> => {
  const flowRef = randomBytes(32).toString('base64url')
  const serviceToken = await authServiceToken('auth:session:signin')

  const response = await fetch(PHOENIX_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${serviceToken}`,
    },
    body: JSON.stringify({
      query: SIGNIN_OAUTH_MUTATION,
      variables: { browserSession, provider, flowRef, returnTo },
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

  const signin = payload.data?.signinOauth
  if (signin?.status === 'REGISTRATION_REQUIRED') {
    throw new OauthRegistrationRequired(flowRef, signin.registration?.suggestedLogin ?? null)
  }
  const result = signin?.session
  if (
    signin?.status !== 'SIGNED_IN' ||
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

/** Builds auth config from typed auth inputs. */
export const buildAuthConfig = ({
  onPhoenixSignin = () => undefined,
  onSessionToken = () => undefined,
  signinOauth: exchangeIdentity = signinOauth,
  providers = Object.values(OAUTH_PROVIDERS).map((provider) => provider.auth()),
  resolveRedirect = resolveAuthRedirect,
}: TAuthDependencies & {
  providers?: AuthConfig['providers']
  resolveRedirect?: typeof resolveAuthRedirect
} = {}): AuthConfig => {
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
    providers,
    callbacks: {
      async redirect({ url, baseUrl }) {
        return resolveRedirect({
          url,
          baseUrl,
          sharedDomain: process.env.AUTH_COOKIE_DOMAIN,
        })
      },
      async jwt({ token, account, profile }) {
        if (!account || !profile) return token

        const definition = oauthProvider(account.provider)
        if (!definition) throw new Error('Unsupported OAuth provider.')
        const provider = definition.identity(profile, account.providerAccountId)

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

/** Builds phoenix token cookie from typed auth inputs. */
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
 * and reading cookies during server rendering would make the route dynamic.
 * This hint lets client code decide whether to call `me` without exposing the
 * actual Phoenix token or changing route caching behavior.
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

/** Reads the HttpOnly Phoenix access cookie for Auth-to-Phoenix delegation. */
export const readPhoenixUserToken = (request: Request): string | null => {
  const cookie = request.headers.get('cookie')
  if (!cookie) return null

  for (const part of cookie.split(';')) {
    const [name, ...valueParts] = part.trim().split('=')
    if (name !== GROUPHER_AUTH_TOKEN_COOKIE) continue

    const value = valueParts.join('=').trim()
    if (!value) return null
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }

  return null
}

/** Builds auth cookie clearing headers from typed auth inputs. */
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

/** Runs the to canonical auth request operation at the auth boundary. */
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

/** Runs the append phoenix token cookie operation at the auth boundary. */
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
  "Refresh a persisted Browser Session for canonical Auth only."
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
  "Revoke the current persisted Browser Session for canonical Auth only."
  mutation RevokeBrowserSession($browserSessionRef: String!) {
    revokeBrowserSession(browserSessionRef: $browserSessionRef) {
      done
    }
  }
`

const LIST_BROWSER_SESSIONS_QUERY = `
  "List Browser Sessions for canonical Auth through trusted transport only."
  query BrowserSessions($browserSessionRef: String!, $pagi: PagiInput) {
    browserSessions(browserSessionRef: $browserSessionRef, pagi: $pagi) {
      entries {
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
      pageInfo { __typename hasNextPage hasPreviousPage ... on OffsetPageInfo {page size totalCount totalPages} ... on CursorPageInfo {startCursor endCursor} }
    }
  }
`

const REVOKE_BROWSER_SESSION_PUBLIC_MUTATION = `
  "Revokes a browser session identified by its public reference through Auth."
  mutation RevokeBrowserSessionPublic($browserSessionRef: String!, $publicRef: String!) {
    revokeBrowserSessionPublic(browserSessionRef: $browserSessionRef, publicRef: $publicRef) { done }
  }
`

const REVOKE_OTHER_BROWSER_SESSIONS_MUTATION = `
  "Revokes the other browser sessions while retaining the current session."
  mutation RevokeOtherBrowserSessions($browserSessionRef: String!) {
    revokeOtherBrowserSessions(browserSessionRef: $browserSessionRef) { done }
  }
`

const LINKED_OAUTH_ACCOUNTS_QUERY = `
  "List linked OAuth accounts for canonical Auth."
  query LinkedOauthAccounts {
    linkedOauthAccounts {
      entries {
        publicRef
        provider
        login
        nickname
        avatar
        canUnlink
        linkedAt
      }
    }
  }
`

const UNLINK_OAUTH_IDENTITY_MUTATION = `
  "Unlink one OAuth binding through canonical Auth."
  mutation UnlinkOauthIdentity($publicRef: ID!) {
    unlinkOauthIdentity(publicRef: $publicRef) {
      entries {
        publicRef
        provider
        login
        nickname
        avatar
        canUnlink
        linkedAt
      }
    }
  }
`

const callPhoenix = async <TData>(
  query: string,
  variables: Record<string, unknown>,
  scope: string,
  userToken?: string,
): Promise<TData> => {
  const serviceToken = await authServiceToken(scope)

  let response: Response
  try {
    response = await fetch(PHOENIX_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${serviceToken}`,
        ...(userToken ? { [GROUPHER_USER_AUTHORIZATION_HEADER]: `Bearer ${userToken}` } : {}),
      },
      body: JSON.stringify({ query, variables }),
      cache: 'no-store',
    })
  } catch {
    throw new PhoenixBrowserSessionError('Phoenix request was not completed.', {
      code: AUTH_ERROR.PHOENIX_NETWORK_ERROR,
      upstreamStatus: undefined,
    })
  }
  if (!response.ok) {
    throw new PhoenixBrowserSessionError(`Phoenix request failed with status ${response.status}.`, {
      upstreamStatus: response.status,
    })
  }

  const payload = (await response.json()) as {
    data?: TData
    errors?: Array<{ extensions?: { code?: unknown }; message?: string }>
  }
  if (payload.errors?.length || !payload.data) {
    const error = payload.errors?.[0]
    throw new PhoenixBrowserSessionError(error?.message || 'Phoenix request failed.', {
      code: normalizePhoenixErrorCode(error?.extensions?.code),
    })
  }

  return payload.data
}

/** Reads public provider admission from Phoenix. */
export const listOauthProviders = async () => {
  const data = await callPhoenix<{ oauthProviders: Array<{ provider: string; state: string }> }>(
    `query OauthProviders { oauthProviders { provider state } }`,
    {},
    'auth:oauth:flow',
  )
  if (!Array.isArray(data.oauthProviders)) throw new Error('OAuth providers unavailable.')
  return data.oauthProviders
}

type TLinkFlowStart = {
  ref: string
  browserSessionRef: string
  provider: string
  codeVerifier: string
  nonce: string
  returnTo: string
}

/** Starts a link flow for the delegated user and browser session. */
export const startOauthLink = async (userToken: string, input: TLinkFlowStart) => {
  const data = await callPhoenix<{ oauthLinkStart: { done: boolean } }>(
    `mutation OauthLinkStart($ref: String!, $browserSessionRef: String!, $provider: String!, $codeVerifier: String!, $nonce: String!, $returnTo: String!) {
      oauthLinkStart(ref: $ref, browserSessionRef: $browserSessionRef, provider: $provider, codeVerifier: $codeVerifier, nonce: $nonce, returnTo: $returnTo) { done }
    }`,
    input,
    'auth:oauth:flow',
    userToken,
  )
  if (!data.oauthLinkStart?.done) throw new Error('OAuth link could not start.')
}

/** Claims one callback exchange and retrieves its verifier. */
export const claimOauthLink = async (
  userToken: string,
  ref: string,
  browserSessionRef: string,
  provider: string,
  nonce: string,
) => {
  const data = await callPhoenix<{ oauthLinkClaim: { codeVerifier: string; returnTo: string } }>(
    `mutation OauthLinkClaim($ref: String!, $browserSessionRef: String!, $provider: String!, $nonce: String!) {
      oauthLinkClaim(ref: $ref, browserSessionRef: $browserSessionRef, provider: $provider, nonce: $nonce) { codeVerifier returnTo }
    }`,
    { ref, browserSessionRef, provider, nonce },
    'auth:oauth:flow',
    userToken,
  )
  if (!data.oauthLinkClaim?.codeVerifier) throw new Error('OAuth link claim failed.')
  return data.oauthLinkClaim
}

/** Stores a verified identity for explicit confirmation. */
export const verifyOauthLink = async (
  userToken: string,
  ref: string,
  browserSessionRef: string,
  identity: Record<string, unknown>,
) => {
  const data = await callPhoenix<{ oauthLinkVerified: { status: string; returnTo: string } }>(
    `mutation OauthLinkVerified($ref: String!, $browserSessionRef: String!, $identity: VerifiedOauthIdentityInput!) {
      oauthLinkVerified(ref: $ref, browserSessionRef: $browserSessionRef, identity: $identity) { status returnTo }
    }`,
    { ref, browserSessionRef, identity },
    'auth:oauth:flow',
    userToken,
  )
  if (!data.oauthLinkVerified) throw new Error('OAuth link verification failed.')
  return data.oauthLinkVerified
}

/** Reads the pending identity for the initiating session. */
export const readOauthLink = async (userToken: string, ref: string, browserSessionRef: string) => {
  const data = await callPhoenix<{
    oauthLinkSummary: {
      provider: string
      providerId: string
      login: string | null
      returnTo: string
    }
  }>(
    `query OauthLinkSummary($ref: String!, $browserSessionRef: String!) {
      oauthLinkSummary(ref: $ref, browserSessionRef: $browserSessionRef) { provider providerId login returnTo }
    }`,
    { ref, browserSessionRef },
    'auth:oauth:flow',
    userToken,
  )
  if (!data.oauthLinkSummary) throw new Error('OAuth link unavailable.')
  return data.oauthLinkSummary
}

/** Cancels the pending identity confirmation. */
export const cancelOauthLink = async (
  userToken: string,
  ref: string,
  browserSessionRef: string,
) => {
  const data = await callPhoenix<{ oauthLinkCancel: { done: boolean } }>(
    `mutation OauthLinkCancel($ref: String!, $browserSessionRef: String!) {
      oauthLinkCancel(ref: $ref, browserSessionRef: $browserSessionRef) { done }
    }`,
    { ref, browserSessionRef },
    'auth:oauth:flow',
    userToken,
  )
  if (!data.oauthLinkCancel?.done) throw new Error('OAuth link cancellation failed.')
}

/** Confirms the displayed identity and consumes its link flow. */
export const confirmOauthLink = async (
  userToken: string,
  ref: string,
  browserSessionRef: string,
  provider: string,
  providerId: string,
) => {
  const data = await callPhoenix<{ oauthLinkConfirm: { returnTo: string } }>(
    `mutation OauthLinkConfirm($ref: String!, $browserSessionRef: String!, $provider: String!, $providerId: String!) {
      oauthLinkConfirm(ref: $ref, browserSessionRef: $browserSessionRef, provider: $provider, providerId: $providerId) { returnTo }
    }`,
    { ref, browserSessionRef, provider, providerId },
    'auth:oauth:flow',
    userToken,
  )
  if (!data.oauthLinkConfirm) throw new Error('OAuth link confirmation failed.')
  return data.oauthLinkConfirm
}

/** Reads the pending registration summary through its opaque reference. */
export const readOauthRegistration = async (flowRef: string) => {
  const data = await callPhoenix<{
    oauthRegistrationSummary: {
      provider: string
      suggestedLogin: string | null
      returnTo: string | null
    }
  }>(
    `query OauthRegistrationSummary($flowRef: String!) {
      oauthRegistrationSummary(flowRef: $flowRef) { provider suggestedLogin returnTo }
    }`,
    { flowRef },
    'auth:oauth:flow',
  )
  if (!data.oauthRegistrationSummary) throw new Error('OAuth registration unavailable.')
  return data.oauthRegistrationSummary
}

/** Completes registration and returns Phoenix session credentials. */
export const completeOauthRegistration = async (
  flowRef: string,
  login: string,
  browserSession: TBrowserSessionMetadata,
) => {
  const data = await callPhoenix<{ completeOauthRegistration: TBrowserSigninResult }>(
    `mutation CompleteOauthRegistration($flowRef: String!, $login: String!, $browserSession: BrowserSessionMetadataInput) {
      completeOauthRegistration(flowRef: $flowRef, login: $login, browserSession: $browserSession) {
        accessToken accessExpiresAt browserSessionRef sessionAbsoluteExpiresAt
      }
    }`,
    { flowRef, login, browserSession },
    'auth:oauth:register',
  )
  const session = data.completeOauthRegistration
  if (
    !session ||
    !session.accessToken ||
    !session.browserSessionRef ||
    !session.sessionAbsoluteExpiresAt ||
    !session.accessExpiresAt
  ) {
    throw new Error('Phoenix returned an invalid browser session.')
  }
  return session
}

/** Signs the Auth session and Phoenix cookies after registration. */
export const createSignedInResponse = async (
  session: TBrowserSigninResult,
  location: string,
): Promise<Response> => {
  const secret = process.env.NEXTAUTH_SECRET?.trim()
  if (!secret) throw new Error('Auth session secret is not configured.')
  const cookieName = getAuthSessionCookieName(useSecureCookies)
  const maxAge = Math.max(
    1,
    Math.min(
      BROWSER_SESSION_MAX_AGE,
      Math.floor((Date.parse(session.sessionAbsoluteExpiresAt) - Date.now()) / 1000),
    ),
  )
  const token = await encode({
    secret,
    salt: cookieName,
    maxAge,
    token: {
      browserSessionRef: session.browserSessionRef,
      sessionAbsoluteExpiresAt: session.sessionAbsoluteExpiresAt,
    },
  })
  const headers = new Headers({ location, 'cache-control': 'no-store' })
  headers.append(
    'set-cookie',
    serialize(cookieName, token, {
      httpOnly: true,
      secure: useSecureCookies,
      sameSite: 'lax',
      path: '/',
      maxAge,
    }),
  )
  return appendPhoenixTokenCookie(new Response(null, { status: 303, headers }), session)
}

const linkedAccountsResult = (data: {
  linkedOauthAccounts?: { entries?: unknown }
}): TLinkedOauthAccount[] => {
  const entries = data.linkedOauthAccounts?.entries
  if (!Array.isArray(entries)) throw new Error('Phoenix returned invalid linked OAuth accounts.')

  return entries as TLinkedOauthAccount[]
}

/** Lists linked oauth accounts through the bounded auth interface. */
export const listLinkedOauthAccounts = async (userToken: string): Promise<TLinkedOauthAccount[]> =>
  linkedAccountsResult(
    await callPhoenix<{ linkedOauthAccounts?: { entries?: unknown } }>(
      LINKED_OAUTH_ACCOUNTS_QUERY,
      {},
      'auth:oauth:read',
      userToken,
    ),
  )

/** Runs the unlink oauth identity operation at the auth boundary. */
export const unlinkOauthIdentity = async (
  userToken: string,
  publicRef: string,
): Promise<TLinkedOauthAccount[]> => {
  const data = await callPhoenix<{ unlinkOauthIdentity?: { entries?: unknown } }>(
    UNLINK_OAUTH_IDENTITY_MUTATION,
    { publicRef },
    'auth:oauth:unlink',
    userToken,
  )
  return linkedAccountsResult({ linkedOauthAccounts: data.unlinkOauthIdentity })
}

/** Runs the refresh browser session operation at the auth boundary. */
export const refreshBrowserSession = async (ref: string): Promise<TBrowserSigninResult> => {
  const data = await callPhoenix<{ refreshBrowserSession?: Partial<TBrowserSigninResult> }>(
    REFRESH_BROWSER_SESSION_MUTATION,
    { browserSessionRef: ref },
    'auth:session:refresh',
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

/** Runs the revoke browser session operation at the auth boundary. */
export const revokeBrowserSession = async (ref: string): Promise<void> => {
  const data = await callPhoenix<{ revokeBrowserSession?: { done?: unknown } }>(
    REVOKE_BROWSER_SESSION_MUTATION,
    { browserSessionRef: ref },
    'auth:session:revoke',
  )
  if (data.revokeBrowserSession?.done !== true)
    throw new Error('Phoenix did not revoke the browser session.')
}

/** Reads the canonical session page through the trusted Auth service scope. */
export const listBrowserSessions = async (
  ref: string,
  pagi?: PagiInput,
): Promise<PagiPage<TBrowserSessionSummary>> => {
  const data = await callPhoenix<{ browserSessions: PagiPage<TBrowserSessionSummary> }>(
    LIST_BROWSER_SESSIONS_QUERY,
    { browserSessionRef: ref, ...(pagi ? { pagi } : {}) },
    'auth:session:read',
  )
  const page = data.browserSessions
  if (!page || !Array.isArray(page.entries) || !page.pageInfo)
    throw new Error('Phoenix returned an invalid browser session page.')
  return page
}

/** Runs the revoke browser session public operation at the auth boundary. */
export const revokeBrowserSessionPublic = async (ref: string, publicRef: string): Promise<void> => {
  const data = await callPhoenix<{ revokeBrowserSessionPublic?: { done?: unknown } }>(
    REVOKE_BROWSER_SESSION_PUBLIC_MUTATION,
    { browserSessionRef: ref, publicRef },
    'auth:session:revoke',
  )
  if (data.revokeBrowserSessionPublic?.done !== true)
    throw new Error('Phoenix did not revoke the browser session.')
}

/** Runs the revoke other browser sessions operation at the auth boundary. */
export const revokeOtherBrowserSessions = async (ref: string): Promise<void> => {
  const data = await callPhoenix<{ revokeOtherBrowserSessions?: { done?: unknown } }>(
    REVOKE_OTHER_BROWSER_SESSIONS_MUTATION,
    { browserSessionRef: ref },
    'auth:session:revoke',
  )
  if (data.revokeOtherBrowserSessions?.done !== true)
    throw new Error('Phoenix did not revoke other browser sessions.')
}

const issuedAuthSession = (response: Response): boolean => {
  const sessionCookie = getAuthSessionCookieName(useSecureCookies)
  const setCookie = response.headers.get('set-cookie') || ''

  return setCookie.includes(`${sessionCookie}=`) || setCookie.includes(`${sessionCookie}.0=`)
}

/** Creates auth request handler from typed auth inputs. */
export const createAuthRequestHandler = ({
  authCore = callAuthCore,
  signinOauth: exchangeIdentity = signinOauth,
  revokeBrowserSession: revokeSession = revokeBrowserSession,
  providers,
  resolveRedirect = resolveAuthRedirect,
}: TAuthRequestDependencies = {}) => {
  return async (request: Request): Promise<Response> => {
    let browserSession: TBrowserSigninResult | undefined
    let registration: OauthRegistrationRequired | undefined
    const authUrl = process.env.AUTH_URL || new URL(request.url).origin
    const callbackCookieName = getAuthCookieNames(useSecureCookies).callbackUrl
    const callbackCookie = request.headers
      .get('cookie')
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${callbackCookieName}=`))
    let returnTo = authUrl
    try {
      const value = callbackCookie?.slice(callbackCookieName.length + 1)
      if (value)
        returnTo = resolveRedirect({
          url: decodeURIComponent(value),
          baseUrl: authUrl,
          sharedDomain: process.env.AUTH_COOKIE_DOMAIN,
        })
    } catch {
      returnTo = authUrl
    }
    const config = buildAuthConfig({
      providers,
      resolveRedirect,
      onPhoenixSignin: (result) => {
        browserSession = result
      },
      signinOauth: async (provider) => {
        try {
          return await exchangeIdentity(
            provider,
            {
              userAgentSummary:
                request.headers
                  .get('user-agent')
                  ?.slice(0, BROWSER_SESSION_USER_AGENT_MAX_LENGTH) || undefined,
            },
            returnTo,
          )
        } catch (error) {
          if (error instanceof OauthRegistrationRequired) registration = error
          throw error
        }
      },
    })
    let response: Response
    try {
      response = await authCore(toCanonicalAuthRequest(request), config)
    } catch (error) {
      if (browserSession) {
        await revokeSession(browserSession.browserSessionRef).catch(() => undefined)
      }
      if (!registration) throw error
      response = new Response(null, { status: 303 })
    }

    if (registration) {
      const registrationReturn = new URL(returnTo)
      registrationReturn.searchParams.set('oauthRegistration', 'required')
      const headers = new Headers({
        location: registrationReturn.toString(),
        'cache-control': 'no-store',
      })
      headers.append(
        'set-cookie',
        serialize(
          `${useSecureCookies ? '__Host-' : ''}groupher-auth.registration`,
          registration.flowRef,
          {
            httpOnly: true,
            secure: useSecureCookies,
            sameSite: 'lax',
            path: '/',
            maxAge: 600,
          },
        ),
      )
      return new Response(null, { status: 303, headers })
    }

    if (browserSession && !issuedAuthSession(response)) {
      await revokeSession(browserSession.browserSessionRef).catch(() => undefined)
      return response
    }

    return browserSession ? appendPhoenixTokenCookie(response, browserSession) : response
  }
}

export const handleAuthRequest = createAuthRequestHandler()
