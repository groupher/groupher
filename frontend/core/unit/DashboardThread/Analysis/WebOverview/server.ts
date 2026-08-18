import { graphql } from '~/graphql/authoring'

import type { TAnalysisTrendsOverview, TAnalysisWebMetric } from './spec'

export const ANALYSIS_TRENDS_OVERVIEW_QUERY = graphql(`
  query AnalysisTrendsOverview($community: String!, $days: Int) {
    analysisTrendsOverview(community: $community, days: $days) {
      status
      provider
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
      chart {
        bucket
        points {
          timestamp
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
`)

const unavailableMetric = (): TAnalysisWebMetric => ({
  value: 0,
  previousValue: null,
  changeRate: null,
})

/** Runs the unavailable overview operation at the frontend shared boundary. */
export const unavailableOverview = (
  errors: TAnalysisTrendsOverview['errors'] = [],
): TAnalysisTrendsOverview => ({
  status: 'unavailable',
  provider: 'umami',
  range: { days: 7, startAt: '0', endAt: '0', bucket: 'day' },
  summary: {
    pageviews: unavailableMetric(),
    visitors: unavailableMetric(),
    visits: unavailableMetric(),
    bounceRate: unavailableMetric(),
    visitDuration: unavailableMetric(),
  },
  chart: { bucket: 'day', points: [] },
  errors,
})
