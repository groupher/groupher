defmodule GroupherServer.Test.Helper.Schema.Analysis do
  @moduledoc "GraphQL documents used by Analysis tests."

  def q(:summary) do
    """
    query($community: String!, $days: Int) {
      analysisWebSummary(community: $community, days: $days) {
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
        topPages {
          path
          pageviews
        }
      }
    }
    """
  end

  def q(:overview) do
    """
    query($community: String!, $days: Int) {
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
          bounceRate {
            value
            previousValue
            changeRate
          }
        }
        timeseries {
          status
          bucket
          points {
            timestamp
            views
            visits
          }
        }
        pages {
          status
          path {
            value
            label
            metrics {
              views
              visitors
              visits
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
          }
          device {
            value
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
          }
          city {
            value
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
          section
        }
      }
    }
    """
  end
end
