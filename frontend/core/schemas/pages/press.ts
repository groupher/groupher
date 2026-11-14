import { graphql } from '~/graphql/authoring'

export const pressConfig = graphql(`
  "Loads the Press configuration for a community."
  query PressConfig($community: String!) {
    pressConfig(community: $community) {
      markdownEnabled
      feedEnabled
      feedType
      feedCount
      feedThreads
      llmsEnabled
      sitemapEnabled
      revision
    }
  }
`)

export const updatePressConfig = graphql(`
  "Updates a community's Press configuration."
  mutation UpdatePressConfig($input: UpdatePressConfigInput!, $commandId: ID!) {
    updatePressConfig(input: $input, commandId: $commandId) {
      config {
        markdownEnabled
        feedEnabled
        feedType
        feedCount
        feedThreads
        llmsEnabled
        sitemapEnabled
        revision
      }
    }
  }
`)

export default {
  pressConfig,
  updatePressConfig,
}
