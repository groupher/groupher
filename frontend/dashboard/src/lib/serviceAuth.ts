import { GROUPHER_USER_AUTHORIZATION_HEADER } from '@groupher/contracts/headers'
import { createServiceAuthClientFromEnv, type TServiceAuthClient } from '@groupher/service/auth'

let provider: TServiceAuthClient | undefined

const serviceToken = (resource: string, scope: string) => {
  provider ??= createServiceAuthClientFromEnv()
  return provider.getToken({ resource, scopes: [scope] })
}

/** Runs the dashboard to phoenix headers operation at the frontend shared boundary. */
export const dashboardToPhoenixHeaders = async (userToken: string, scope: string) => ({
  Authorization: `Bearer ${await serviceToken('https://api.groupher.com/dashboard', scope)}`,
  [GROUPHER_USER_AUTHORIZATION_HEADER]: `Bearer ${userToken}`,
})

/** Runs the dashboard to content import headers operation at the frontend shared boundary. */
export const dashboardToContentImportHeaders = async (
  userToken: string | null,
  scope = 'docs:import:proxy',
) => ({
  Authorization: `Bearer ${await serviceToken(
    'https://content-import.groupher.com/internal',
    scope,
  )}`,
  ...(userToken ? { [GROUPHER_USER_AUTHORIZATION_HEADER]: `Bearer ${userToken}` } : {}),
})
