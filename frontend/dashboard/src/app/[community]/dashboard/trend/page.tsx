import { gqFetch } from '~/graphql/server'
import WebOverview from '~/unit/DashboardThread/Analysis/WebOverview'
import type { TAnalysisWebOverview } from '~/unit/DashboardThread/Analysis/WebOverview/spec'

import { ANALYSIS_TRENDS_QUERY, emptyOverview } from './helper'

type TGraphQLError = { message?: unknown }
type TGraphQLPayload<T> = { data?: T | null; errors?: TGraphQLError[] }

type TAnalysisTrendsQueryData = {
  analysisTrends: TAnalysisWebOverview | null
}

const unavailableOverview = (
  community: string,
  errors: TGraphQLError[] = [],
): TAnalysisWebOverview => ({
  ...emptyOverview(community),
  errors: errors.map((error) => ({
    code: 'graphql_error',
    message: typeof error.message === 'string' ? error.message : 'GraphQL request failed',
    section: 'overview',
    providerStatus: null,
  })),
})

export default async function TrendPage({ params }) {
  const { community } = await params

  try {
    const response = await gqFetch(ANALYSIS_TRENDS_QUERY, {
      community,
      days: 7,
    })
    const payload = (await response.json()) as TGraphQLPayload<TAnalysisTrendsQueryData>
    if (payload.errors) return <WebOverview data={unavailableOverview(community, payload.errors)} />

    return <WebOverview data={payload.data?.analysisTrends ?? unavailableOverview(community)} />
  } catch (err) {
    console.error('## analysis trends ssr error: ', err)
    return (
      <WebOverview
        data={unavailableOverview(community, [
          { message: err instanceof Error ? err.message : 'GraphQL request failed' },
        ])}
      />
    )
  }
}
