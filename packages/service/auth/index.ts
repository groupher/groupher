import { createRemoteJWKSet, jwtVerify } from 'jose'

export type TServiceTokenRequest = {
  resource: string
  scopes: readonly string[]
}

export type TServiceAuthClient = {
  getToken(request: TServiceTokenRequest): Promise<string>
}

export type TServiceActor = {
  audience: string
  scopes: ReadonlySet<string>
  subject: string
  tokenId: string
}

export type TServiceAuthVerifier = {
  verify(token: string, requiredScope: string): Promise<TServiceActor>
}

export class ServiceTokenAuthorizationError extends Error {
  readonly status: 401 | 403

  constructor(message: string, status: 401 | 403) {
    super(message)
    this.name = 'ServiceTokenAuthorizationError'
    this.status = status
  }
}

/** Runs the service token error status operation at the service boundary. */
export const serviceTokenErrorStatus = (error: unknown): 401 | 403 =>
  error instanceof ServiceTokenAuthorizationError ? error.status : 401

type TTokenResponse = {
  access_token?: unknown
  expires_in?: unknown
  token_type?: unknown
}

type TServiceTokenClientOptions = {
  clientId: string
  clientSecret: string
  endpoint: string
  fetcher?: typeof fetch
  refreshSkewSeconds?: number
}

type TCachedToken = {
  expiresAt: number
  token: string
}

const cacheKey = ({ resource, scopes }: TServiceTokenRequest) =>
  `${resource}\n${[...scopes].sort().join(' ')}`

/** Creates service auth client from typed service inputs. */
export const createServiceAuthClient = ({
  clientId,
  clientSecret,
  endpoint,
  fetcher = fetch,
  refreshSkewSeconds = 30,
}: TServiceTokenClientOptions): TServiceAuthClient => {
  if (!clientId || !clientSecret || !endpoint) {
    throw new Error('Service identity client configuration is incomplete.')
  }

  const cache = new Map<string, TCachedToken>()
  const inflight = new Map<string, Promise<string>>()

  const acquire = async (request: TServiceTokenRequest): Promise<string> => {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      resource: request.resource,
      scope: request.scopes.join(' '),
    })
    const basic = Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64')
    const response = await fetcher(endpoint, {
      body,
      headers: {
        authorization: `Basic ${basic}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      method: 'POST',
      signal: AbortSignal.timeout(5_000),
    })
    const payload = (await response.json().catch(() => null)) as TTokenResponse | null
    if (
      !response.ok ||
      payload?.token_type !== 'Bearer' ||
      typeof payload.access_token !== 'string' ||
      typeof payload.expires_in !== 'number'
    ) {
      throw new Error(`Service token acquisition failed with status ${response.status}.`)
    }

    cache.set(cacheKey(request), {
      expiresAt: Date.now() + payload.expires_in * 1_000,
      token: payload.access_token,
    })
    return payload.access_token
  }

  return {
    async getToken(request) {
      const key = cacheKey(request)
      const cached = cache.get(key)
      if (cached && cached.expiresAt - refreshSkewSeconds * 1_000 > Date.now()) return cached.token

      const active = inflight.get(key)
      if (active) return active

      const pending = acquire(request).finally(() => inflight.delete(key))
      inflight.set(key, pending)
      return pending
    },
  }
}

/** Creates service auth client from env from typed service inputs. */
export const createServiceAuthClientFromEnv = (
  environment: Record<string, string | undefined> = process.env,
  fetcher: typeof fetch = fetch,
): TServiceAuthClient =>
  createServiceAuthClient({
    clientId: environment.SERVICE_AUTH_CLIENT_ID?.trim() || '',
    clientSecret: environment.SERVICE_AUTH_CLIENT_SECRET?.trim() || '',
    endpoint: environment.SERVICE_AUTH_TOKEN_ENDPOINT?.trim() || '',
    fetcher,
  })

/** Creates service auth verifier from typed service inputs. */
export const createServiceAuthVerifier = ({
  audience,
  issuer,
  jwksUrl,
}: {
  audience: string
  issuer: string
  jwksUrl: string
}): TServiceAuthVerifier => {
  const jwks = createRemoteJWKSet(new URL(jwksUrl), {
    cacheMaxAge: 5 * 60 * 1_000,
    cooldownDuration: 30_000,
  })

  return {
    async verify(token, requiredScope) {
      const { payload } = await jwtVerify(token, jwks, {
        algorithms: ['RS256'],
        audience,
        issuer,
        typ: 'service_access+jwt',
      })
      const scopes = new Set(typeof payload.scope === 'string' ? payload.scope.split(/\s+/) : [])
      if (
        !payload.sub?.startsWith('service:') ||
        !payload.jti ||
        !payload.iat ||
        !payload.exp ||
        payload.exp - payload.iat > 15 * 60
      ) {
        throw new ServiceTokenAuthorizationError('The service token is invalid.', 401)
      }
      if (!scopes.has(requiredScope)) {
        throw new ServiceTokenAuthorizationError(
          'The service token does not grant the required scope.',
          403,
        )
      }
      return { audience, scopes, subject: payload.sub, tokenId: payload.jti }
    },
  }
}

/** Runs the bearer token operation at the service boundary. */
export const bearerToken = (authorization: string | undefined): string | null =>
  authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() || null : null
