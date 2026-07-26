import { createHmac, timingSafeEqual } from 'node:crypto'

import { GROUPHER_AUTH_TOKEN_COOKIE } from '~/constant/auth-contract'

type TJwtHeader = {
  alg?: unknown
  typ?: unknown
}

type TJwtPayload = {
  exp?: unknown
  iss?: unknown
  nbf?: unknown
}

const SUPPORTED_ALGORITHMS = {
  HS256: 'sha256',
  HS384: 'sha384',
  HS512: 'sha512',
} as const

const PHOENIX_TOKEN_ISSUER = process.env.PHOENIX_TOKEN_ISSUER || 'groupher_server'

const base64UrlDecode = (value: string): Buffer => {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  return Buffer.from(base64 + padding, 'base64')
}

const decodeJsonPart = <T>(value: string): T | null => {
  try {
    return JSON.parse(base64UrlDecode(value).toString('utf8')) as T
  } catch {
    return null
  }
}

const safeEqual = (left: Buffer, right: Buffer): boolean =>
  left.length === right.length && timingSafeEqual(left, right)

const isTimeClaimValid = (claim: unknown, nowSeconds: number, compare: 'after' | 'before') => {
  if (claim === undefined) return true
  if (typeof claim !== 'number' || !Number.isFinite(claim)) return false

  return compare === 'before' ? nowSeconds < claim : nowSeconds >= claim
}

const isVerifiedPhoenixToken = (token: string, now = new Date()): boolean => {
  const secret = process.env.GUARDIAN_KEY?.trim()
  if (!secret) return false

  const parts = token.split('.')
  if (parts.length !== 3 || parts.some((part) => !part)) return false

  const [encodedHeader, encodedPayload, encodedSignature] = parts
  const header = decodeJsonPart<TJwtHeader>(encodedHeader)
  const payload = decodeJsonPart<TJwtPayload>(encodedPayload)
  if (!header || !payload) return false

  const algorithm = header.alg
  if (
    typeof algorithm !== 'string' ||
    !(algorithm in SUPPORTED_ALGORITHMS) ||
    payload.iss !== PHOENIX_TOKEN_ISSUER
  ) {
    return false
  }

  const digest = SUPPORTED_ALGORITHMS[algorithm as keyof typeof SUPPORTED_ALGORITHMS]
  const signature = base64UrlDecode(encodedSignature)
  const expectedSignature = createHmac(digest, secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest()

  if (!safeEqual(signature, expectedSignature)) return false

  const nowSeconds = Math.floor(now.getTime() / 1000)
  return (
    isTimeClaimValid(payload.exp, nowSeconds, 'before') &&
    isTimeClaimValid(payload.nbf, nowSeconds, 'after')
  )
}

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
    const token = decodeURIComponent(value)
    return isVerifiedPhoenixToken(token) ? token : null
  } catch {
    return isVerifiedPhoenixToken(value) ? value : null
  }
}
