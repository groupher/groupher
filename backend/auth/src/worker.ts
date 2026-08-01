type TWorkerEnv = {
  AUTH_COOKIE_DOMAIN?: string
  AUTH_GITHUB_ID?: string
  AUTH_GITHUB_SECRET?: string
  AUTH_URL?: string
  GROUPHER_SERVER_TRUST_SECRET?: string
  NEXTAUTH_SECRET?: string
  NODE_ENV?: string
  PHOENIX_GRAPHQL_ENDPOINT?: string
}

type TExecutionContext = {
  passThroughOnException(): void
  waitUntil(promise: Promise<unknown>): void
}

const bindEnvToProcess = (env: TWorkerEnv): void => {
  globalThis.process ??= { env: {} } as NodeJS.Process
  Object.assign(process.env, env)
}

export default {
  async fetch(request: Request, env: TWorkerEnv, context: TExecutionContext): Promise<Response> {
    bindEnvToProcess(env)
    const { default: app } = await import('./app')

    return app.fetch(request, env, context as never)
  },
}
