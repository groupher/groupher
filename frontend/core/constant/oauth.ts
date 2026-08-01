export const SOCIAL = {
  GITHUB: 'github',
  // GOOGLE: 'google'
} as const

export const AUTH_ENDPOINT = process.env.NEXT_PUBLIC_AUTH_ENDPOINT || '/api/auth'

export const LOGOUT_ENDPOINT = `${AUTH_ENDPOINT}/logout`
