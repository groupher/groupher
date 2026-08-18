/**
 * Exposes the Auth Cloudflare Worker entrypoint.
 *
 * Business position:
 *
 *   Browser / Gateway
 *     -> Auth module
 *     -> OAuth provider / Phoenix Accounts
 *     -> Session cookies or service token
 */

type TWorkerEnv = {
  AUTH_OAUTH_RATE_LIMITER?: {
    limit(input: { key: string }): Promise<{ success: boolean }>
  }
  AUTH_REFRESH_RATE_LIMITER?: {
    limit(input: { key: string }): Promise<{ success: boolean }>
  }
  SERVICE_TOKEN_RATE_LIMITER?: {
    limit(input: { key: string }): Promise<{ success: boolean }>
  }
  LINK_INTENTS?: {
    idFromName(name: string): { toString(): string }
    get(id: { toString(): string }): {
      fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
    }
  }
  AUTH_COOKIE_DOMAIN?: string
  AUTH_GITHUB_ID?: string
  AUTH_GITHUB_SECRET?: string
  AUTH_URL?: string
  NEXTAUTH_SECRET?: string
  NODE_ENV?: string
  PHOENIX_GRAPHQL_ENDPOINT?: string
  SERVICE_AUTH_CLIENTS_JSON?: string
  SERVICE_AUTH_CLIENT_ID?: string
  SERVICE_AUTH_CLIENT_SECRET?: string
  SERVICE_AUTH_ISSUER?: string
  SERVICE_AUTH_RESOURCES_JSON?: string
  SERVICE_AUTH_SIGNING_JWK?: string
  SERVICE_AUTH_TOKEN_TTL_SECONDS?: string
  SERVICE_AUTH_TOKEN_ENDPOINT?: string
}

type TExecutionContext = {
  passThroughOnException(): void
  waitUntil(promise: Promise<unknown>): void
}

const bindEnvToProcess = (env: TWorkerEnv): void => {
  globalThis.process ??= { env: {} } as NodeJS.Process
  for (const [name, value] of Object.entries(env)) {
    if (typeof value === 'string') process.env[name] = value
  }
}

export default {
  async fetch(request: Request, env: TWorkerEnv, context: TExecutionContext): Promise<Response> {
    bindEnvToProcess(env)
    const { default: app } = await import('./app')

    return app.fetch(request, env, context as never)
  },
}

export { LinkIntentObject } from './link-intent'
