import {
  createServiceAuthClientFromEnv,
  type TServiceAuthClient,
  type TServiceTokenRequest,
} from '@groupher/service/auth'

type ServiceAuthEnvironment = Record<string, string | undefined>
type ServiceAuthClientFactory = typeof createServiceAuthClientFromEnv

/** Creates an isolate-local cache of service-auth clients keyed by credential configuration. */
export const createServiceAuthClientCache = (
  createClient: ServiceAuthClientFactory = createServiceAuthClientFromEnv,
): ((environment: ServiceAuthEnvironment) => TServiceAuthClient) => {
  let activeClientId: string | undefined
  let activeClientSecret: string | undefined
  let activeTokenEndpoint: string | undefined
  let activeClient: TServiceAuthClient | undefined

  const clientFor = (environment: ServiceAuthEnvironment): TServiceAuthClient => {
    const clientId = environment.SERVICE_AUTH_CLIENT_ID?.trim() || ''
    const clientSecret = environment.SERVICE_AUTH_CLIENT_SECRET?.trim() || ''
    const tokenEndpoint = environment.SERVICE_AUTH_TOKEN_ENDPOINT?.trim() || ''

    if (
      !activeClient ||
      clientId !== activeClientId ||
      clientSecret !== activeClientSecret ||
      tokenEndpoint !== activeTokenEndpoint
    ) {
      activeClient = createClient(environment)
      activeClientId = clientId
      activeClientSecret = clientSecret
      activeTokenEndpoint = tokenEndpoint
    }

    return activeClient
  }

  return (environment) => ({
    getToken(request: TServiceTokenRequest) {
      return clientFor(environment).getToken(request)
    },
  })
}

export const pressServiceAuthClient = createServiceAuthClientCache()
