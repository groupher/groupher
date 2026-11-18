/** Stable identity used by the ordinary, non-administrator local browser login. */
export const LOCAL_DEV_LOGIN_IDENTITY = 'local-debug'
/** Stable identity reserved for the separately gated local administrator login. */
export const LOCAL_DEV_ADMIN_LOGIN_IDENTITY = 'local-passport-admin'

const LOCAL_HOSTS = new Set([
  'auth.groupher.localhost',
  'localhost',
  '127.0.0.1',
  '::1',
])

/** Returns whether ordinary local login is enabled outside production. */
export const isLocalDevLoginEnabled = (env: NodeJS.ProcessEnv = process.env): boolean =>
  env.NODE_ENV !== 'production' && env.AUTH_LOCAL_LOGIN_ENABLED === 'true'

/** Returns whether the additional local administrator login is explicitly enabled. */
export const isLocalDevAdminLoginEnabled = (env: NodeJS.ProcessEnv = process.env): boolean =>
  isLocalDevLoginEnabled(env) && env.AUTH_LOCAL_ADMIN_LOGIN_ENABLED === 'true'

/** Restricts the local login route to HTTP(S) requests addressed to loopback hosts. */
export const isLocalDevLoginRequest = (request: Request): boolean => {
  try {
    const url = new URL(request.url)
    return ['http:', 'https:'].includes(url.protocol) && LOCAL_HOSTS.has(url.hostname)
  } catch {
    return false
  }
}
