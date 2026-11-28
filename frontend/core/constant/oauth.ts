import { API_ROUTE, AUTH_ROUTE } from '@groupher/route-contract'

export const SOCIAL = {
  GITHUB: 'github',
  LINUXDO: 'linuxdo',
  // GOOGLE: 'google'
} as const

/** Rejects provider IDs not supported by this frontend build. */
export const isOauthProvider = (value: string): value is (typeof SOCIAL)[keyof typeof SOCIAL] =>
  Object.values(SOCIAL).some((provider) => provider === value)

const defaultAuthEndpoint =
  process.env.NODE_ENV === 'production'
    ? 'https://auth.groupher.com/api/auth'
    : process.env.NODE_ENV === 'test'
      ? API_ROUTE.AUTH
      : 'https://groupher.localhost/api/auth'

/** Canonical Auth origin; product applications never proxy refresh or logout. */
export const AUTH_ENDPOINT = (process.env.NEXT_PUBLIC_AUTH_ENDPOINT || defaultAuthEndpoint).replace(
  /\/$/,
  '',
)

export const LOGOUT_ENDPOINT = `${AUTH_ENDPOINT}${AUTH_ROUTE.LOGOUT.replace(API_ROUTE.AUTH, '')}`
