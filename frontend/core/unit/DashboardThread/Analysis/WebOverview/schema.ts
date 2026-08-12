import { graphql } from '~/graphql/authoring'

export const ANALYSIS_TREND_PAGES_QUERY = graphql(`
  query AnalysisTrendPages(
    $community: String!
    $days: Int
    $dimension: AnalysisTrendPagesDimension!
  ) {
    analysisTrendPages(community: $community, days: $days, dimension: $dimension) {
      status
      items {
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
      error {
        code
        message
        section
        providerStatus
      }
    }
  }
`)

export const ANALYSIS_TREND_SOURCES_QUERY = graphql(`
  query AnalysisTrendSources(
    $community: String!
    $days: Int
    $dimension: AnalysisTrendSourcesDimension!
  ) {
    analysisTrendSources(community: $community, days: $days, dimension: $dimension) {
      status
      items {
        value
        label
        metrics {
          visitors
          visits
          views
        }
      }
      error {
        code
        message
        section
        providerStatus
      }
    }
  }
`)

export const ANALYSIS_TREND_ENVIRONMENT_QUERY = graphql(`
  query AnalysisTrendEnvironment(
    $community: String!
    $days: Int
    $dimension: AnalysisTrendEnvironmentDimension!
  ) {
    analysisTrendEnvironment(community: $community, days: $days, dimension: $dimension) {
      status
      items {
        value
        label
        metrics {
          visitors
          visits
          views
          percentage
        }
      }
      error {
        code
        message
        section
        providerStatus
      }
    }
  }
`)

export const ANALYSIS_TREND_LOCATION_QUERY = graphql(`
  query AnalysisTrendLocation(
    $community: String!
    $days: Int
    $dimension: AnalysisTrendLocationDimension!
  ) {
    analysisTrendLocation(community: $community, days: $days, dimension: $dimension) {
      status
      items {
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
      error {
        code
        message
        section
        providerStatus
      }
    }
  }
`)

export const ANALYSIS_TREND_TRAFFIC_QUERY = graphql(`
  query AnalysisTrendTraffic($community: String!, $days: Int) {
    analysisTrendTraffic(community: $community, days: $days) {
      status
      timezone
      cells {
        weekday
        hour
        visitors
        visits
        views
      }
      error {
        code
        message
        section
        providerStatus
      }
    }
  }
`)
