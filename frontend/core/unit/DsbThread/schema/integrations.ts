import { graphql } from '~/graphql/authoring'

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
  thirdPartyAnalyticsProviders,
  openGraphInfo,
}
