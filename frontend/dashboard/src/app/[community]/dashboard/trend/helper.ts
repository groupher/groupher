import type {
  TAnalysisWebMetric,
  TAnalysisWebOverview,
} from '~/unit/DashboardThread/Analysis/WebOverview/spec'

export const ANALYSIS_WEB_OVERVIEW_QUERY = `
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

export const emptyOverview = (community: string): TAnalysisWebOverview => ({
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
