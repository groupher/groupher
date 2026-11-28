import { createHmac } from 'node:crypto'

import { GROUPHER_AUTH_TOKEN_COOKIE } from '@groupher/contracts/auth-cookie'
import { AUTH_ERROR, PHOENIX_BROWSER_TOKEN_CLAIMS } from '@groupher/contracts/auth-generated'
import { GraphQLError } from 'graphql'

const ACCESS_TTL_SECONDS = Number(process.env.E2E_AUTH_ACCESS_TTL_SECONDS ?? 60)
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 90
const PHOENIX_E2E_SECRET = process.env.PHX_JWT_SECRET || 'e2e-phoenix-browser-secret'

let sessionSequence = 0
let tokenSequence = 0
let sessions = new Map()
let accessTokens = new Map()
let stats = {}
let registrations = new Map()

const resetStats = () => ({
  protectedCalls: 0,
  refreshCalls: 0,
  revokeCalls: 0,
  signInCalls: 0,
})

/** Runs the reset auth state operation at the frontend shared boundary. */
export const resetAuthState = () => {
  sessionSequence = 0
  tokenSequence = 0
  sessions = new Map()
  accessTokens = new Map()
  stats = resetStats()
  registrations = new Map()
}

resetAuthState()

const expiresAt = (seconds) => new Date(Date.now() + seconds * 1000).toISOString()

const issuePhoenixToken = (session, sequence) => {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const header = encode({ alg: 'HS256', typ: 'JWT' })
  const payload = encode({
    aud: PHOENIX_BROWSER_TOKEN_CLAIMS.audience,
    exp: Math.floor(Date.now() / 1000) + ACCESS_TTL_SECONDS,
    iss: PHOENIX_BROWSER_TOKEN_CLAIMS.issuer,
    jti: `e2e-${sequence}`,
    sub: session.login,
    typ: PHOENIX_BROWSER_TOKEN_CLAIMS.type,
  })
  const signature = createHmac('sha256', PHOENIX_E2E_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url')

  return `${header}.${payload}.${signature}`
}

const sessionFailure = (code) => {
  throw new GraphQLError(
    code === AUTH_ERROR.SESSION_REVOKED ? 'Browser Session was revoked.' : 'Session failed.',
    {
      extensions: { code },
    },
  )
}

const activeSession = (ref) => {
  const session = sessions.get(ref)
  if (!session) sessionFailure(AUTH_ERROR.SESSION_EXPIRED)
  if (session.status !== 'active') sessionFailure(AUTH_ERROR.SESSION_REVOKED)
  return session
}

const issueAccess = (session) => {
  const token = issuePhoenixToken(session, ++tokenSequence)
  const accessExpiresAt = expiresAt(ACCESS_TTL_SECONDS)
  accessTokens.set(token, { expiresAt: accessExpiresAt, sessionRef: session.ref })
  session.lastSeenAt = new Date().toISOString()

  return {
    accessToken: token,
    accessExpiresAt,
    browserSessionRef: session.ref,
    sessionAbsoluteExpiresAt: session.absoluteExpiresAt,
  }
}

/** Creates auth session from typed frontend shared inputs. */
export const createAuthSession = (provider, metadata = {}) => {
  stats.signInCalls += 1
  const id = ++sessionSequence
  const now = new Date().toISOString()
  const ref = `session-${id}`
  const userAgent = metadata.userAgentSummary || 'E2E Browser'
  const session = {
    absoluteExpiresAt: expiresAt(SESSION_TTL_SECONDS),
    browserFamily: metadata.browserFamily || userAgent,
    createdCity: metadata.createdCity || 'Shanghai',
    createdCountry: metadata.createdCountry || 'CN',
    createdRegion: metadata.createdRegion || 'Shanghai',
    deviceFamily: metadata.deviceFamily || 'Desktop',
    insertedAt: now,
    lastSeenAt: now,
    login: provider.login || 'e2e',
    osFamily: metadata.osFamily || 'Test OS',
    publicRef: `public-${id}`,
    ref,
    status: 'active',
    userAgentSummary: userAgent,
  }
  sessions.set(ref, session)
  return issueAccess(session)
}

/** Runs the refresh auth session operation at the frontend shared boundary. */
export const refreshAuthSession = (ref) => {
  stats.refreshCalls += 1
  return issueAccess(activeSession(ref))
}

/** Lists auth sessions through the bounded frontend shared interface. */
export const listAuthSessions = (currentRef) => {
  const current = activeSession(currentRef)
  return [...sessions.values()]
    .filter((session) => session.login === current.login && session.status === 'active')
    .map((session) => ({
      browserFamily: session.browserFamily,
      createdCity: session.createdCity,
      createdCountry: session.createdCountry,
      createdRegion: session.createdRegion,
      deviceFamily: session.deviceFamily,
      insertedAt: session.insertedAt,
      isCurrent: session.ref === currentRef,
      lastSeenAt: session.lastSeenAt,
      osFamily: session.osFamily,
      publicRef: session.publicRef,
      status: session.status,
      userAgentSummary: session.userAgentSummary,
    }))
}

/** Runs the revoke auth session operation at the frontend shared boundary. */
export const revokeAuthSession = (ref) => {
  stats.revokeCalls += 1
  const session = activeSession(ref)
  session.status = 'revoked'
  return { done: true }
}

/** Runs the revoke auth session public operation at the frontend shared boundary. */
export const revokeAuthSessionPublic = (currentRef, publicRef) => {
  stats.revokeCalls += 1
  const current = activeSession(currentRef)
  const target = [...sessions.values()].find(
    (session) => session.publicRef === publicRef && session.login === current.login,
  )
  if (!target) sessionFailure(AUTH_ERROR.SESSION_EXPIRED)
  target.status = 'revoked'
  return { done: true }
}

/** Runs the revoke other auth sessions operation at the frontend shared boundary. */
export const revokeOtherAuthSessions = (currentRef) => {
  stats.revokeCalls += 1
  const current = activeSession(currentRef)
  for (const session of sessions.values()) {
    if (session.login === current.login && session.ref !== currentRef) session.status = 'revoked'
  }
  return { done: true }
}

const readCookie = (cookieHeader, name) => {
  for (const part of (cookieHeader || '').split(';')) {
    const [cookieName, ...value] = part.trim().split('=')
    if (cookieName === name) return value.join('=')
  }
  return null
}

/** Runs the record protected request operation at the frontend shared boundary. */
export const recordProtectedRequest = (cookieHeader) => {
  stats.protectedCalls += 1
  const token = readCookie(cookieHeader, GROUPHER_AUTH_TOKEN_COOKIE)
  if (!token) return AUTH_ERROR.TOKEN_MISSING
  const access = accessTokens.get(token)
  if (!access) return AUTH_ERROR.TOKEN_INVALID
  if (Date.parse(access.expiresAt) <= Date.now()) return AUTH_ERROR.TOKEN_EXPIRED
  const session = sessions.get(access.sessionRef)
  if (!session || session.status !== 'active') return AUTH_ERROR.SESSION_REVOKED
  return null
}

/** Runs the expire access tokens operation at the frontend shared boundary. */
export const expireAccessTokens = () => {
  const expiredAt = new Date(Date.now() - 1_000).toISOString()
  for (const access of accessTokens.values()) access.expiresAt = expiredAt
}

/** Returns auth state for the frontend shared workflow. */
export const getAuthState = () => ({
  sessions: [...sessions.values()].map((session) => ({ ...session })),
  stats: { ...stats },
})

/** Stores the pending mock registration under Auth's generated flow reference. */
export const createAuthRegistration = (ref, identity, returnTo) => {
  registrations.set(ref, { provider: identity.provider, suggestedLogin: identity.login, returnTo })
  return {
    status: 'REGISTRATION_REQUIRED',
    session: null,
    registration: { suggestedLogin: identity.login },
  }
}
/** Reads a pending registration in the isolated mock stack. */
export const readAuthRegistration = (ref) => registrations.get(ref) || null
/** Expires registrations for an isolated browser test. */
export const expireAuthRegistrations = () => registrations.clear()
/** Consumes a pending mock registration and issues its test session. */
export const completeAuthRegistration = (ref, login, metadata) => {
  if (!registrations.has(ref)) return null
  registrations.delete(ref)
  return createAuthSession({ login }, metadata || {})
}
