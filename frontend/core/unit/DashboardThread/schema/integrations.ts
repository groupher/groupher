import { graphql } from '~/graphql/authoring'

export const pressConfig = graphql(`
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
  mutation UpdateDashboardPressConfig($input: UpdatePressConfigInput!) {
    updatePressConfig(input: $input) {
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
  query DashboardOpenGraphInfo($url: String!) {
    openGraphInfo(url: $url) {
      title
      favicon
      url
      siteName
    }
  }
`)

export default { pressConfig, updatePressConfig, thirdPartyAnalyticsProviders, openGraphInfo }
