import { graphql } from '~/graphql/authoring'

export const ANALYSIS_TREND_PAGES_QUERY = graphql(`
  "One built-in community Analysis page dimension"
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
  "One built-in community Analysis source dimension"
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
  "One built-in community Analysis environment dimension"
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
  "One built-in community Analysis location dimension"
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
  "UTC weekly traffic cells for built-in community Analysis"
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
