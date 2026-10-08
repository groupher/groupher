import type { ResultOf, VariablesOf } from '@graphql-typed-document-node/core'

import { browserGraphQLRequest } from '~/graphql/client'
import { executeCommand } from '~/query/mutation/optimistic/execute'

import S from './schema'

export type TContentShadowSavePlan = {
  community: string
  enabled: boolean
}

/** Sends one ordinary Dashboard content-shadow field update. */
export const executeContentShadowUpdate = async (
  plan: TContentShadowSavePlan,
  commandId?: string,
): Promise<
  NonNullable<ResultOf<typeof S.updateDashboardContentShadow>['updateDashboardContentShadow']>
> => {
  const result = await executeCommand<
    VariablesOf<typeof S.updateDashboardContentShadow>,
    ResultOf<typeof S.updateDashboardContentShadow>
  >({
    request: (variables) => browserGraphQLRequest(S.updateDashboardContentShadow, variables),
    variables: plan,
    commandId,
  })

  if (!result.updateDashboardContentShadow) {
    throw new Error('DASHBOARD_CONTENT_SHADOW_UPDATE_EMPTY_RESPONSE')
  }

  return result.updateDashboardContentShadow
}
