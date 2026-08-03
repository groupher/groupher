import { headers } from 'next/headers'

import { GRAPHQL_ENDPOINT } from '~/config'

type TGraphQLError = { message?: unknown }
type TGraphQLPayload<T> = { data?: T | null; errors?: TGraphQLError[] }

export type TWebAnalysisSummary = {
  status: string
  provider: string
  pathScope: string
  error: string | null
  range: {
    days: number
    startAt: string
    endAt: string
  }
  summary: {
    pageviews: number
    visitors: number
    visits: number
    bounces: number
    totalTime: number
  }
  timeseries: {
    date: string
    pageviews: number
    visits: number
  }[]
  topPages: {
    path: string
    title: string | null
    pageviews: number
    visitors: number
    visits: number
    bounces: number
    totalTime: number
  }[]
  topReferrers: {
    referrer: string
    visitors: number
  }[]
}

type TWebAnalysisQueryData = {
  webAnalysisSummary: TWebAnalysisSummary | null
}

const WEB_ANALYSIS_SUMMARY_QUERY = `
  query WebAnalysisSummary($community: String!, $days: Int) {
    webAnalysisSummary(community: $community, days: $days) {
      status
      provider
      pathScope
      error
      range {
        days
        startAt
        endAt
      }
      summary {
        pageviews
        visitors
        visits
        bounces
        totalTime
      }
      timeseries {
        date
        pageviews
        visits
      }
      topPages {
        path
        title
        pageviews
        visitors
        visits
        bounces
        totalTime
      }
      topReferrers {
        referrer
        visitors
      }
    }
  }
`

const emptySummary = (community: string): TWebAnalysisSummary => ({
  status: 'unavailable',
  provider: 'umami',
  pathScope: `/${community}`,
  error: 'web analysis is unavailable',
  range: {
    days: 7,
    startAt: '0',
    endAt: '0',
  },
  summary: {
    pageviews: 0,
    visitors: 0,
    visits: 0,
    bounces: 0,
    totalTime: 0,
  },
  timeseries: [],
  topPages: [],
  topReferrers: [],
})

export const fetchWebAnalysisSummary = async (community: string): Promise<TWebAnalysisSummary> => {
  try {
    const headerStore = await headers()
    const cookie = headerStore.get('cookie')
    const authorization = headerStore.get('authorization')

    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { cookie } : {}),
        ...(authorization ? { authorization } : {}),
      },
      body: JSON.stringify({
        query: WEB_ANALYSIS_SUMMARY_QUERY,
        variables: { community, days: 7 },
      }),
    })

    if (!response.ok) return emptySummary(community)

    const payload = (await response.json()) as TGraphQLPayload<TWebAnalysisQueryData>
    if (payload.errors || !payload.data?.webAnalysisSummary) return emptySummary(community)

    return payload.data.webAnalysisSummary
  } catch (error) {
    console.error('## web analysis ssr error: ', error)
    return emptySummary(community)
  }
}
