import { graphql } from '~/graphql/authoring'

export const ANALYSIS_ACTIVE_VISITORS_QUERY = graphql(`
  "Current active visitors for the built-in community Analysis"
  query AnalysisActiveVisitors($community: String!) {
    analysisActiveVisitors(community: $community) {
      visitors
    }
  }
`)
