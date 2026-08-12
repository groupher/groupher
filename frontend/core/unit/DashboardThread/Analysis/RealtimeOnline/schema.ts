import { graphql } from '~/graphql/authoring'

export const ANALYSIS_ACTIVE_VISITORS_QUERY = graphql(`
  query AnalysisActiveVisitors($community: String!) {
    analysisActiveVisitors(community: $community) {
      visitors
    }
  }
`)
