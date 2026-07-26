import { GROUPHER_AUTH_TOKEN_COOKIE } from '~/constant/auth-contract'

export const getPhoenixToken = (request: Request): string | null => {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return null

  const cookie = cookieHeader
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${GROUPHER_AUTH_TOKEN_COOKIE}=`))
  if (!cookie) return null

  const value = cookie.slice(`${GROUPHER_AUTH_TOKEN_COOKIE}=`.length)

  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
