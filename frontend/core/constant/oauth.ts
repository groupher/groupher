export const SOCIAL = {
  GITHUB: 'github',
  // GOOGLE: 'google'
} as const

const defaultAuthEndpoint =
  process.env.NODE_ENV === 'production'
    ? 'https://auth.groupher.com/api/auth'
    : process.env.NODE_ENV === 'test'
      ? '/api/auth'
      : 'https://groupher.localhost/api/auth'

/** Canonical Auth origin; product applications never proxy refresh or logout. */
export const AUTH_ENDPOINT = (process.env.NEXT_PUBLIC_AUTH_ENDPOINT || defaultAuthEndpoint).replace(
  /\/$/,
  '',
)

export const LOGOUT_ENDPOINT = `${AUTH_ENDPOINT}/logout`
