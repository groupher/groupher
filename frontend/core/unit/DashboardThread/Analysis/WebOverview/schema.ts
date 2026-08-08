import { gql } from 'urql'

export const ANALYSIS_TREND_PAGES_QUERY = gql`
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
`

export const ANALYSIS_TREND_SOURCES_QUERY = gql`
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
`

export const ANALYSIS_TREND_ENVIRONMENT_QUERY = gql`
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
`

export const ANALYSIS_TREND_LOCATION_QUERY = gql`
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
`

export const ANALYSIS_TREND_TRAFFIC_QUERY = gql`
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
`
