import { GROUPHER_USER_AUTHORIZATION_HEADER } from '@groupher/contracts/headers'
import {
  createServiceTokenProviderFromEnv,
  type TServiceTokenProvider,
} from '@groupher/service/auth'

let provider: TServiceTokenProvider | undefined

const serviceToken = (resource: string, scope: string) => {
  provider ??= createServiceTokenProviderFromEnv()
  return provider.getToken({ resource, scopes: [scope] })
}

export const dashboardToPhoenixHeaders = async (userToken: string, scope: string) => ({
  Authorization: `Bearer ${await serviceToken('https://api.groupher.com/dashboard', scope)}`,
  [GROUPHER_USER_AUTHORIZATION_HEADER]: `Bearer ${userToken}`,
})

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
