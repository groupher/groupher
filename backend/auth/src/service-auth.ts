/**
 * Implements the Src Service Auth boundary inside Auth.
 *
 * Business position:
 *
 *   Browser / Gateway
 *     -> Auth module
 *     -> OAuth provider / Phoenix Accounts
 *     -> Session cookies or service token
 */

import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'

import { importJWK, SignJWT, type JWK } from 'jose'

export const SERVICE_TOKEN_TTL_SECONDS = 10 * 60
export const SERVICE_TOKEN_MAX_TTL_SECONDS = 15 * 60

type TServiceClient = {
  allowedAudiences: string[]
  allowedScopes: string[]
  clientId: string
  clientRef: string
  credentialHashes: string[]
  serviceName: string
  status: 'active' | 'disabled'
}

type TServiceAuthConfig = {
  clients: TServiceClient[]
  issuer: string
  resources: Record<string, string>
  signingJwk: JWK
  ttlSeconds: number
}

type TTokenFailure = {
  error: 'invalid_client' | 'invalid_grant' | 'invalid_request' | 'invalid_scope' | 'invalid_target'
  error_description: string
  status: 400 | 401
}

export type TServiceTokenResult =
  | TTokenFailure
  | { access_token: string; expires_in: number; scope: string; token_type: 'Bearer' }

const jsonEnv = <T>(environment: Record<string, string | undefined>, name: string): T => {
  const value = environment[name]?.trim()
  if (!value) throw new Error(`${name} is not configured.`)
  return JSON.parse(value) as T
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

const matchesCredential = (secret: string, expected: string): boolean => {
  const actual = Buffer.from(sha256(secret), 'hex')
  const normalized = expected.startsWith('sha256:') ? expected.slice(7) : expected
  const wanted = Buffer.from(normalized, 'hex')
  return actual.length === wanted.length && timingSafeEqual(actual, wanted)
}

/** Reads service auth config through the bounded auth interface. */
export const readServiceAuthConfig = (
  environment: Record<string, string | undefined> = process.env,
): TServiceAuthConfig => {
  const ttlSeconds = Number.parseInt(environment.SERVICE_AUTH_TOKEN_TTL_SECONDS || '', 10)
  return {
    clients: jsonEnv<TServiceClient[]>(environment, 'SERVICE_AUTH_CLIENTS_JSON'),
    issuer: environment.SERVICE_AUTH_ISSUER?.trim() || environment.AUTH_URL?.trim() || '',
    resources: jsonEnv<Record<string, string>>(environment, 'SERVICE_AUTH_RESOURCES_JSON'),
    signingJwk: jsonEnv<JWK>(environment, 'SERVICE_AUTH_SIGNING_JWK'),
    ttlSeconds:
      Number.isFinite(ttlSeconds) && ttlSeconds > 0
        ? Math.min(ttlSeconds, SERVICE_TOKEN_MAX_TTL_SECONDS)
        : SERVICE_TOKEN_TTL_SECONDS,
  }
}

const readBasicCredentials = (authorization: string | undefined) => {
  if (!authorization?.startsWith('Basic ')) return null
  try {
    const value = Buffer.from(authorization.slice(6), 'base64').toString('utf8')
    const separator = value.indexOf(':')
    if (separator < 1) return null
    return {
      clientId: decodeURIComponent(value.slice(0, separator)),
      clientSecret: decodeURIComponent(value.slice(separator + 1)),
    }
  } catch {
    return null
  }
}

/** Runs the issue service token operation at the auth boundary. */
export const issueServiceToken = async (
  request: Request,
  environment: Record<string, string | undefined> = process.env,
): Promise<TServiceTokenResult> => {
  const credentials = readBasicCredentials(request.headers.get('authorization') || undefined)
  if (!credentials) {
    return {
      error: 'invalid_client',
      error_description: 'Client authentication is required.',
      status: 401,
    }
  }

  const form = await request.formData().catch(() => null)
  if (!form || form.get('grant_type') !== 'client_credentials') {
    return { error: 'invalid_grant', error_description: 'Unsupported grant type.', status: 400 }
  }

  const config = readServiceAuthConfig(environment)
  const client = config.clients.find((item) => item.clientId === credentials.clientId)
  if (
    !client ||
    client.status !== 'active' ||
    !client.credentialHashes.some((hash) => matchesCredential(credentials.clientSecret, hash))
  ) {
    return {
      error: 'invalid_client',
      error_description: 'Client authentication failed.',
      status: 401,
    }
  }

  const resource = form.get('resource')
  if (typeof resource !== 'string' || !URL.canParse(resource)) {
    return {
      error: 'invalid_target',
      error_description: 'A registered resource URI is required.',
      status: 400,
    }
  }
  const audience = config.resources[resource]
  if (!audience || !client.allowedAudiences.includes(audience)) {
    return {
      error: 'invalid_target',
      error_description: 'The requested resource is not allowed.',
      status: 400,
    }
  }

  const requestedScopes =
    typeof form.get('scope') === 'string'
      ? String(form.get('scope')).split(/\s+/).filter(Boolean)
      : []
  const scopes = requestedScopes.filter((scope) => client.allowedScopes.includes(scope))
  if (requestedScopes.length === 0 || scopes.length === 0) {
    return {
      error: 'invalid_scope',
      error_description: 'No requested scope can be granted.',
      status: 400,
    }
  }

  const privateKey = await importJWK(config.signingJwk, 'RS256')
  const now = Math.floor(Date.now() / 1_000)
  const token = await new SignJWT({ scope: scopes.join(' ') })
    .setProtectedHeader({ alg: 'RS256', kid: config.signingJwk.kid, typ: 'service_access+jwt' })
    .setIssuer(config.issuer)
    .setSubject(`service:${client.serviceName}`)
    .setAudience(audience)
    .setIssuedAt(now)
    .setNotBefore(now)
    .setExpirationTime(now + config.ttlSeconds)
    .setJti(randomUUID())
    .sign(privateKey)

  console.info('[service-auth] token_issued', {
    audience,
    clientRef: client.clientRef,
    scopes,
  })
  return {
    access_token: token,
    expires_in: config.ttlSeconds,
    scope: scopes.join(' '),
    token_type: 'Bearer',
  }
}

/** Runs the service jwks operation at the auth boundary. */
export const serviceJwks = async (
  environment: Record<string, string | undefined> = process.env,
) => {
  const { signingJwk } = readServiceAuthConfig(environment)
  if (signingJwk.kty !== 'RSA' || !signingJwk.n || !signingJwk.e) {
    throw new Error('SERVICE_AUTH_SIGNING_JWK must be an RSA private JWK.')
  }
  return {
    keys: [
      {
        alg: 'RS256',
        e: signingJwk.e,
        kid: signingJwk.kid,
        kty: signingJwk.kty,
        n: signingJwk.n,
        use: 'sig',
      },
    ],
  }
}
