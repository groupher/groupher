import { GraphQLError } from 'graphql'

const ACCESS_TTL_SECONDS = Number(process.env.E2E_AUTH_ACCESS_TTL_SECONDS ?? 60)
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 90

let sessionSequence = 0
let tokenSequence = 0
let sessions = new Map()
let accessTokens = new Map()
let stats = {}

const resetStats = () => ({
  protectedCalls: 0,
  refreshCalls: 0,
  revokeCalls: 0,
  signInCalls: 0,
})

export const resetAuthState = () => {
  sessionSequence = 0
  tokenSequence = 0
  sessions = new Map()
  accessTokens = new Map()
  stats = resetStats()
}

resetAuthState()

const expiresAt = (seconds) => new Date(Date.now() + seconds * 1000).toISOString()

const sessionFailure = (code) => {
  throw new GraphQLError(
    code === 'SESSION_REVOKED' ? 'Browser Session was revoked.' : 'Session failed.',
    {
      extensions: { code },
    },
  )
}

const activeSession = (ref) => {
  const session = sessions.get(ref)
  if (!session) sessionFailure('SESSION_EXPIRED')
  if (session.status !== 'active') sessionFailure('SESSION_REVOKED')
  return session
}

const issueAccess = (session) => {
  const token = `e2e-access-${session.ref}-${++tokenSequence}`
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

export const refreshAuthSession = (ref) => {
  stats.refreshCalls += 1
  return issueAccess(activeSession(ref))
}

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

export const revokeAuthSession = (ref) => {
  stats.revokeCalls += 1
  const session = activeSession(ref)
  session.status = 'revoked'
  return { done: true }
}

export const revokeAuthSessionPublic = (currentRef, publicRef) => {
  stats.revokeCalls += 1
  const current = activeSession(currentRef)
  const target = [...sessions.values()].find(
    (session) => session.publicRef === publicRef && session.login === current.login,
  )
  if (!target) sessionFailure('SESSION_EXPIRED')
  target.status = 'revoked'
  return { done: true }
}

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

export const recordProtectedRequest = (cookieHeader) => {
  stats.protectedCalls += 1
  const token = readCookie(cookieHeader, 'groupher-auth.token')
  if (!token) return 'TOKEN_MISSING'
  const access = accessTokens.get(token)
  if (!access) return 'TOKEN_INVALID'
  if (Date.parse(access.expiresAt) <= Date.now()) return 'TOKEN_EXPIRED'
  const session = sessions.get(access.sessionRef)
  if (!session || session.status !== 'active') return 'SESSION_REVOKED'
  return null
}

export const expireAccessTokens = () => {
  const expiredAt = new Date(Date.now() - 1_000).toISOString()
  for (const access of accessTokens.values()) access.expiresAt = expiredAt
}

export const getAuthState = () => ({
  sessions: [...sessions.values()].map((session) => ({ ...session })),
  stats: { ...stats },
})
