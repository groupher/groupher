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
          bounceRate {
            value
            previousValue
            changeRate
          }
        }
        chart {
          bucket
          points {
            timestamp
            views
            visits
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

  def q(:active_visitors) do
    """
    query($community: String!) {
      analysisActiveVisitors(community: $community) {
        visitors
      }
    }
    """
  end

  def q(:pages) do
    """
    query($community: String!, $days: Int, $dimension: AnalysisTrendPagesDimension!) {
      analysisTrendPages(community: $community, days: $days, dimension: $dimension) {
        status
        items { value }
        error { code section }
      }
    }
    """
  end

  def q(:sources) do
    """
    query($community: String!, $days: Int, $dimension: AnalysisTrendSourcesDimension!) {
      analysisTrendSources(community: $community, days: $days, dimension: $dimension) {
        status
        items { value }
        error { code section }
      }
    }
    """
  end

  def q(:environment) do
    """
    query($community: String!, $days: Int, $dimension: AnalysisTrendEnvironmentDimension!) {
      analysisTrendEnvironment(community: $community, days: $days, dimension: $dimension) {
        status
        items { value }
        error { code section }
      }
    }
    """
  end

  def q(:location) do
    """
    query($community: String!, $days: Int, $dimension: AnalysisTrendLocationDimension!) {
      analysisTrendLocation(community: $community, days: $days, dimension: $dimension) {
        status
        items { value }
        error { code section }
      }
    }
    """
  end

  def q(:traffic) do
    """
    query($community: String!, $days: Int) {
      analysisTrendTraffic(community: $community, days: $days) {
        status
        timezone
        cells { weekday hour }
        error { code section }
      }
    }
    """
  end

  def q(:tracking_website_id) do
    """
    query($community: String!) {
      analysisTrackingWebsiteId(community: $community)
    }
    """
  end

  def q(:visitor_location_map) do
    """
    query($community: String!) {
      analysisVisitorLocationMap(community: $community) {
        status
        range { days }
        countries {
          code
          visitors
          percentage
          regions { code visitors }
        }
        error { code message section providerStatus }
      }
    }
    """
  end
end
