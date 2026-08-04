import { headers } from 'next/headers'

import { GRAPHQL_ENDPOINT } from '~/config'
import type {
  TAnalysisWebMetric,
  TAnalysisWebOverview,
} from '~/unit/DashboardThread/Analysis/WebOverview/spec'

type TGraphQLError = { message?: unknown }
type TGraphQLPayload<T> = { data?: T | null; errors?: TGraphQLError[] }

type TAnalysisWebQueryData = {
  analysisWebOverview: TAnalysisWebOverview | null
}

const ANALYSIS_WEB_OVERVIEW_TIMEOUT_MS = 8_000

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
        url {
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
        entry {
          value
          label
          metrics {
            visitors
            visits
            views
          }
        }
        exit {
          value
          label
          metrics {
            visitors
            visits
            views
          }
        }
        title {
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
        query {
          value
          label
          metrics {
            visitors
            visits
            views
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
        channel {
          value
          label
          metrics {
            visitors
            visits
            views
          }
        }
        domain {
          value
          label
          metrics {
            visitors
            visits
            views
          }
        }
      }
      environment {
        status
        browser {
          value
          label
          metrics {
            visitors
            visits
            views
            percentage
          }
        }
        os {
          value
          label
          metrics {
            visitors
            visits
            views
            percentage
          }
        }
        device {
          value
          label
          metrics {
            visitors
            visits
            views
            percentage
          }
        }
        language {
          value
          label
          metrics {
            visitors
            visits
            views
            percentage
          }
        }
        screen {
          value
          label
          metrics {
            visitors
            visits
            views
            percentage
          }
        }
      }
      location {
        status
        country {
          value
          label
          code
          metrics {
            visitors
            visits
            views
            percentage
          }
        }
        region {
          value
          label
          code
          metrics {
            visitors
            visits
            views
            percentage
          }
        }
        city {
          value
          label
          code
          metrics {
            visitors
            visits
            views
            percentage
          }
        }
      }
      traffic {
        status
        timezone
        cells {
          weekday
          hour
          visitors
          visits
          views
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
    url: [],
    entry: [],
    exit: [],
    title: [],
    query: [],
  },
  sources: {
    status: 'unavailable',
    referrer: [],
    channel: [],
    domain: [],
  },
  environment: {
    status: 'unavailable',
    browser: [],
    os: [],
    device: [],
    language: [],
    screen: [],
  },
  location: {
    status: 'unavailable',
    country: [],
    region: [],
    city: [],
  },
  traffic: {
    status: 'unavailable',
    timezone: 'UTC',
    cells: [],
  },
  errors: [],
})

export const fetchAnalysisWebOverview = async (
  community: string,
): Promise<TAnalysisWebOverview> => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ANALYSIS_WEB_OVERVIEW_TIMEOUT_MS)

  try {
    const headerStore = await headers()
    const cookie = headerStore.get('cookie')
    const authorization = headerStore.get('authorization')

    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      cache: 'no-store',
      signal: controller.signal,
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
  } finally {
    clearTimeout(timeout)
  }
}
