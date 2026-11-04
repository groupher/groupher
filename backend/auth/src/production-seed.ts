/**
 * Temporary P0 Auth redemption boundary; remove this route and module at P7.
 * Operator credential -> Phoenix BrowserSession -> official Auth.js + access cookies.
 */
import { encode } from '@auth/core/jwt'
import {
  GROUPHER_AUTH_CSRF_HEADER,
  GROUPHER_AUTH_CSRF_VALUE,
  getAuthSessionCookieName,
} from '@groupher/contracts/auth'
import { serialize } from 'hono/utils/cookie'

import {
  appendPhoenixTokenCookie,
  redeemProductionSeedLogin,
  revokeBrowserSession,
  useSecureCookies,
} from './auth'

type TDependencies = {
  redeem?: typeof redeemProductionSeedLogin
  revoke?: typeof revokeBrowserSession
  encodeSession?: typeof encode
}

/** Exchanges an opaque single-use credential only during an explicitly configured window. */
export const redeemAcceptanceRequest = async (
  request: Request,
  allowedOrigin: (origin: string) => boolean,
  env: Record<string, string | undefined>,
  {
    redeem = redeemProductionSeedLogin,
    revoke = revokeBrowserSession,
    encodeSession = encode,
  }: TDependencies = {},
): Promise<Response> => {
  const headers = { 'cache-control': 'no-store' }
  const deadline = Date.parse(env.PRODUCTION_SEED_LOGIN_UNTIL || '')
  if (
    env.PRODUCTION_SEED_LOGIN_ENABLED !== 'true' ||
    !Number.isFinite(deadline) ||
    deadline <= Date.now()
  )
    return new Response(null, { status: 404, headers })
  const origin = request.headers.get('origin')
  if (
    !origin ||
    !allowedOrigin(origin) ||
    request.headers.get(GROUPHER_AUTH_CSRF_HEADER) !== GROUPHER_AUTH_CSRF_VALUE
  )
    return new Response(null, { status: 403, headers })
  if (!env.NEXTAUTH_SECRET) return new Response(null, { status: 503, headers })
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json')
    return new Response(null, { status: 415, headers })
  let credential: string
  try {
    const reader = request.body?.getReader()
    if (!reader) throw new Error('empty')
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > 2048) {
        await reader.cancel()
        throw new Error('large')
      }
      chunks.push(chunk.value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    const input = JSON.parse(new TextDecoder().decode(bytes))
    if (typeof input.credential !== 'string' || !/^psl_[A-Za-z0-9_-]{43}$/.test(input.credential))
      throw new Error('invalid')
    credential = input.credential
  } catch {
    return new Response(null, { status: 400, headers })
  }

  let result: Awaited<ReturnType<typeof redeem>> | undefined
  try {
    result = await redeem(credential, request.headers.get('user-agent')?.slice(0, 255))
    const maxAge = Math.floor((Date.parse(result.sessionAbsoluteExpiresAt) - Date.now()) / 1000)
    if (!Number.isFinite(maxAge) || maxAge <= 0) throw new Error('expired')
    const name = getAuthSessionCookieName(useSecureCookies)
    const token = await encodeSession({
      secret: env.NEXTAUTH_SECRET,
      salt: name,
      maxAge,
      token: {
        browserSessionRef: result.browserSessionRef,
        sessionAbsoluteExpiresAt: result.sessionAbsoluteExpiresAt,
      },
    })
    const response = new Response(null, { status: 204, headers })
    response.headers.append(
      'set-cookie',
      serialize(name, token, {
        httpOnly: true,
        secure: useSecureCookies,
        sameSite: 'lax',
        path: '/',
        maxAge,
      }),
    )
    return appendPhoenixTokenCookie(response, result)
  } catch {
    if (result) {
      try {
        await revoke(result.browserSessionRef)
      } catch {
        console.error('Acceptance session compensation failed; close the run.')
        return new Response(null, { status: 503, headers })
      }
    }
    return new Response(null, { status: 401, headers })
  }
}
