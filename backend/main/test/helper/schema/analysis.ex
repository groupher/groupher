defmodule GroupherServer.Test.Helper.Schema.Analysis do
  @moduledoc "GraphQL documents used by Analysis tests."

  def q(:summary) do
    """
    query($community: String!, $days: Int) {
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
        topPages {
          path
          pageviews
        }
      }
    }
    """
  end
end
