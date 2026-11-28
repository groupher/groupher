/**
 * Loads and validates runtime environment values for Auth.
 *
 * Business position:
 *
 *   Browser / Gateway
 *     -> Auth module
 *     -> OAuth provider / Phoenix Accounts
 *     -> Session cookies or service token
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { LOCAL_PHOENIX_GRAPHQL_ENDPOINT } from '@groupher/contracts/endpoint'
import { config } from 'dotenv'

const localHostname = (hostname: string) => {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  return (
    host === 'localhost' || host.endsWith('.localhost') || host.startsWith('127.') || host === '::1'
  )
}

const isLocalUrl = (value: string) => {
  try {
    return localHostname(new URL(value).hostname)
  } catch {
    return false
  }
}

/** Resolve the Phoenix target without allowing a development endpoint in production. */
export function resolvePhoenixGraphqlEndpoint(
  environment: Record<string, string | undefined>,
): string {
  const production = environment.NODE_ENV === 'production'
  const endpoint =
    environment.PHOENIX_GRAPHQL_ENDPOINT?.trim() ||
    (production ? 'https://api.groupher.com/graphiql' : LOCAL_PHOENIX_GRAPHQL_ENDPOINT)
  if (production && isLocalUrl(endpoint))
    throw new Error(
      'PHOENIX_GRAPHQL_ENDPOINT must not target a local development service in production.',
    )
  return endpoint
}

/** Load package dotenv files only for unmanaged local Node development. */
export function loadAuthEnvironment(
  environment: Record<string, string | undefined>,
  authRoot: string,
): void {
  if (environment.NODE_ENV === 'production') {
    resolvePhoenixGraphqlEndpoint(environment)
    for (const key of [
      'AUTH_URL',
      'SERVICE_AUTH_ISSUER',
      'SERVICE_AUTH_JWKS_URL',
      'SERVICE_AUTH_TOKEN_ENDPOINT',
    ]) {
      if (environment[key] && isLocalUrl(environment[key]!))
        throw new Error(`${key} must not target a local development service in production.`)
    }
    if (
      environment.AUTH_COOKIE_DOMAIN &&
      localHostname(environment.AUTH_COOKIE_DOMAIN.replace(/^\./, ''))
    )
      throw new Error('AUTH_COOKIE_DOMAIN must not use a local development domain in production.')
    if (environment.E2E_AUTH_STACK === '1')
      throw new Error('E2E_AUTH_STACK is unavailable in production.')
    return
  }
  if (environment.DEV_HUB_MANAGED_ENVIRONMENT === 'true') return
  config({
    path: [
      path.join(authRoot, '.env.local'),
      path.join(authRoot, '.env.development'),
      path.join(authRoot, '.env'),
    ],
    processEnv: environment,
    quiet: true,
  })
  if (environment.NODE_ENV === 'production')
    throw new Error('NODE_ENV=production must be supplied by the process, not local dotenv.')
}

// Worker bindings provide runtime configuration and may omit import.meta.url.
if (import.meta.url) {
  loadAuthEnvironment(process.env, path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'))
}
