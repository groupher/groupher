import { graphql } from '~/graphql/authoring'

export const pressConfig = graphql(`
  "Loads the Press configuration for a community."
  query DashboardPressConfig($community: String!) {
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
  mutation UpdateDashboardPressConfig($input: UpdatePressConfigInput!, $commandId: ID!) {
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

export const thirdPartyAnalyticsProviders = graphql(`
  "Dashboard third-party analytics provider registry"
  query DashboardThirdPartyAnalyticsProviders {
    thirdPartyAnalyticsProviders {
      provider
      title
      desc
      detail
      docsUrl
      icon
      identityField
      configFields {
        key
        label
        desc
        placeholder
        requiredWhenEnabled
        pattern
      }
    }
  }
`)

export const openGraphInfo = graphql(`
  "Get open graph info by url"
  query DashboardOpenGraphInfo($url: String!) {
    openGraphInfo(url: $url) {
      title
      favicon
      url
      siteName
    }
  }
`)

export default {
  pressConfig,
  updatePressConfig,
  thirdPartyAnalyticsProviders,
  openGraphInfo,
}
