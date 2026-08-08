import { createServerFn } from '@tanstack/react-start'

import {
  ANALYSIS_TRENDS_OVERVIEW_QUERY,
  unavailableOverview,
} from '~/unit/DashboardThread/Analysis/WebOverview/server'
import type { TAnalysisTrendsOverview } from '~/unit/DashboardThread/Analysis/WebOverview/spec'

import { fetchGraphQL, getAuthToken, setPrivateCacheHeader } from './graphql'

type TAnalysisTrendsQueryData = {
  analysisTrendsOverview: TAnalysisTrendsOverview | null
}

export type TDashTrendOverview = {
  community: string
  data: TAnalysisTrendsOverview
}

export const loadTrendOverview = createServerFn({ method: 'GET', strict: false })
  .validator((data: { community: string }) => data)
  .handler(async ({ data }): Promise<TDashTrendOverview> => {
    const token = getAuthToken()
    setPrivateCacheHeader()

    try {
      const result = await fetchGraphQL<TAnalysisTrendsQueryData>(
        ANALYSIS_TRENDS_OVERVIEW_QUERY,
        { community: data.community, days: 7 },
        token,
      )
      const errors = result.errors || []

      return {
        community: data.community,
        data:
          result.data?.analysisTrendsOverview ||
          unavailableOverview(
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
        data: unavailableOverview([
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
