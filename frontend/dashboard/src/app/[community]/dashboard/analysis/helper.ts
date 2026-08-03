import { headers } from 'next/headers'

import { GRAPHQL_ENDPOINT } from '~/config'

type TGraphQLError = { message?: unknown }
type TGraphQLPayload<T> = { data?: T | null; errors?: TGraphQLError[] }

export type TAnalysisWebMetric = {
  value: number
  previousValue: number | null
  changeRate: number | null
}

export type TAnalysisWebCountMetrics = {
  visitors: number
  visits: number
  views: number
}

export type TAnalysisWebPageMetrics = TAnalysisWebCountMetrics & {
  bounceRate: number
  visitDuration: number
}

export type TAnalysisWebDimension<TMetrics> = {
  value: string
  label: string
  metrics: TMetrics
}

export type TAnalysisWebOverview = {
  status: string
  provider: string
  pathScope: string
  range: {
    days: number
    startAt: string
    endAt: string
    bucket: string
  }
  summary: {
    pageviews: TAnalysisWebMetric
    visitors: TAnalysisWebMetric
    visits: TAnalysisWebMetric
    bounceRate: TAnalysisWebMetric
    visitDuration: TAnalysisWebMetric
  }
  timeseries: {
    status: string
    bucket: string
    points: {
      bucket: string
      timestamp: string
      visitors: number
      visits: number
      views: number
    }[]
  }
  pages: {
    status: string
    path: TAnalysisWebDimension<TAnalysisWebPageMetrics>[]
  }
  sources: {
    status: string
    referrer: TAnalysisWebDimension<TAnalysisWebCountMetrics>[]
  }
  errors: {
    code: string
    message: string
    section: string
    providerStatus: string | null
  }[]
}

type TAnalysisWebQueryData = {
  analysisWebOverview: TAnalysisWebOverview | null
}

const ANALYSIS_WEB_OVERVIEW_QUERY = `
  query AnalysisWebOverview($community: String!, $days: Int) {
    analysisWebOverview(community: $community, days: $days) {
      status
      provider
      pathScope
      range {
        days
        startAt
        endAt
        bucket
      }
      summary {
        pageviews {
          value
          previousValue
          changeRate
        }
        visitors {
          value
          previousValue
          changeRate
        }
        visits {
          value
          previousValue
          changeRate
        }
        bounceRate {
          value
          previousValue
          changeRate
        }
        visitDuration {
          value
          previousValue
          changeRate
        }
      }
      timeseries {
        status
        bucket
        points {
          bucket
          timestamp
          visitors
          visits
          views
        }
      }
      pages {
        status
        path {
          value
          label
          metrics {
            visitors
            visits
            views
            bounceRate
            visitDuration
          }
        }
      }
      sources {
        status
        referrer {
          value
          label
          metrics {
            visitors
            visits
            views
          }
        }
      }
      errors {
        code
        message
        section
        providerStatus
      }
    }
  }
`

const emptyMetric = (): TAnalysisWebMetric => ({
  value: 0,
  previousValue: null,
  changeRate: null,
})

const emptyOverview = (community: string): TAnalysisWebOverview => ({
  status: 'unavailable',
  provider: 'umami',
  pathScope: `/${community}`,
  range: {
    days: 7,
    startAt: '0',
    endAt: '0',
    bucket: 'day',
  },
  summary: {
    pageviews: emptyMetric(),
    visitors: emptyMetric(),
    visits: emptyMetric(),
    bounceRate: emptyMetric(),
    visitDuration: emptyMetric(),
  },
  timeseries: {
    status: 'unavailable',
    bucket: 'day',
    points: [],
  },
  pages: {
    status: 'unavailable',
    path: [],
  },
  sources: {
    status: 'unavailable',
    referrer: [],
  },
  errors: [],
})

export const fetchAnalysisWebOverview = async (
  community: string,
): Promise<TAnalysisWebOverview> => {
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
        query: ANALYSIS_WEB_OVERVIEW_QUERY,
        variables: { community, days: 7 },
      }),
    })

    if (!response.ok) return emptyOverview(community)

    const payload = (await response.json()) as TGraphQLPayload<TAnalysisWebQueryData>
    if (payload.errors || !payload.data?.analysisWebOverview) return emptyOverview(community)

    return payload.data.analysisWebOverview
  } catch (error) {
    console.error('## web analysis ssr error: ', error)
    return emptyOverview(community)
  }
}
