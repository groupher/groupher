import { connection } from 'next/server'

import { gqAuthFetch } from '~/graphql/server'
import WebOverview from '~/unit/DashboardThread/Analysis/WebOverview'
import {
  ANALYSIS_TRENDS_OVERVIEW_QUERY,
  unavailableOverview as buildUnavailableOverview,
} from '~/unit/DashboardThread/Analysis/WebOverview/server'
import type { TAnalysisTrendsOverview } from '~/unit/DashboardThread/Analysis/WebOverview/spec'

type TGraphQLError = { message?: unknown }
type TGraphQLPayload<T> = { data?: T | null; errors?: TGraphQLError[] }

type TAnalysisTrendsQueryData = {
  analysisTrendsOverview: TAnalysisTrendsOverview | null
}

const unavailableOverview = (errors: TGraphQLError[] = []): TAnalysisTrendsOverview =>
  buildUnavailableOverview(
    errors.map((error) => ({
      code: 'graphql_error',
      message: typeof error.message === 'string' ? error.message : 'GraphQL request failed',
      section: 'overview',
      providerStatus: null,
    })),
  )

export default async function TrendPage({ params }) {
  const { community } = await params
  // This page forwards the current user's auth cookie to Phoenix, so it must
  // render per request rather than as a shared dashboard shell.
  await connection()

  try {
    const response = await gqAuthFetch(ANALYSIS_TRENDS_OVERVIEW_QUERY, {
      community,
      days: 7,
    })
    const payload = (await response.json()) as TGraphQLPayload<TAnalysisTrendsQueryData>
    if (payload.errors) {
      return <WebOverview community={community} data={unavailableOverview(payload.errors)} />
    }

    return (
      <WebOverview
        community={community}
        data={payload.data?.analysisTrendsOverview ?? unavailableOverview()}
      />
    )
  } catch (err) {
    console.error('## analysis trends ssr error: ', err)
    return (
      <WebOverview
        community={community}
        data={unavailableOverview([
          { message: err instanceof Error ? err.message : 'GraphQL request failed' },
        ])}
      />
    )
  }
}
