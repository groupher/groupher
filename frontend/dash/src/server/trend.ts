import { createServerFn } from '@tanstack/react-start'

import {
  ANALYSIS_WEB_OVERVIEW_QUERY,
  unavailableOverview,
} from '~/unit/DashboardThread/Analysis/WebOverview/server'
import type { TAnalysisWebOverview } from '~/unit/DashboardThread/Analysis/WebOverview/spec'

import { fetchGraphQL, getAuthToken, setPrivateCacheHeader } from './graphql'

type TAnalysisWebQueryData = {
  analysisWebOverview: TAnalysisWebOverview | null
}

export type TDashTrendOverview = {
  community: string
  data: TAnalysisWebOverview
}

export const loadTrendOverview = createServerFn({ method: 'GET', strict: false })
  .validator((data: { community: string }) => data)
  .handler(async ({ data }): Promise<TDashTrendOverview> => {
    const token = getAuthToken()
    setPrivateCacheHeader()

    try {
      const result = await fetchGraphQL<TAnalysisWebQueryData>(
        ANALYSIS_WEB_OVERVIEW_QUERY,
        { community: data.community, days: 7 },
        token,
      )
      const errors = result.errors || []

      return {
        community: data.community,
        data:
          result.data?.analysisWebOverview ||
          unavailableOverview(
            data.community,
            errors.map((error) => ({
              code: 'graphql_error',
              message: error.message || 'GraphQL request failed',
              section: 'overview',
              providerStatus: null,
            })),
          ),
      }
    } catch (error) {
      return {
        community: data.community,
        data: unavailableOverview(data.community, [
          {
            code: 'graphql_error',
            message: error instanceof Error ? error.message : 'GraphQL request failed',
            section: 'overview',
            providerStatus: null,
          },
        ]),
      }
    }
  })
