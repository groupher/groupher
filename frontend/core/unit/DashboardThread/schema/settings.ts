import { graphql } from '~/graphql/authoring'

export const updateDashboardBaseInfo = graphql(`
  mutation UpdateDashboardBaseInfo(
    $community: String!
    $homepage: String
    $title: String
    $slug: String
    $desc: String
    $locale: String
    $introduction: String
    $logo: String
    $favicon: String
    $city: String
    $techstack: String
  ) {
    updateDashboardBaseInfo(
      community: $community
      homepage: $homepage
      title: $title
      slug: $slug
      desc: $desc
      locale: $locale
      introduction: $introduction
      logo: $logo
      favicon: $favicon
      city: $city
      techstack: $techstack
    ) {
      baseInfo {
        title
        logo
        favicon
        locale
      }
    }
  }
`)

export const updateDashboardMediaReports = graphql(`
  mutation UpdateDashboardMediaReports($community: String!, $mediaReports: [DsbMediaReportMap]) {
    updateDashboardMediaReports(community: $community, mediaReports: $mediaReports) {
      mediaReports {
        index
        title
        url
        favicon
        siteName
      }
    }
  }
`)

export const updateDashboardThirdPartyAnalytics = graphql(`
  mutation UpdateDashboardThirdPartyAnalytics(
    $community: String!
    $thirdPartyAnalytics: [DsbThirdPartyAnalyticsInput]
  ) {
    updateDashboardThirdPartyAnalytics(
      community: $community
      thirdPartyAnalytics: $thirdPartyAnalytics
    ) {
      thirdPartyAnalytics {
        ...DashboardThirdPartyAnalyticsFields
      }
    }
  }
`)

export const updateDashboardSeo = graphql(`
  mutation UpdateDashboardSeo(
    $community: String!
    $seoEnable: Boolean
    $ogSiteName: String
    $ogTitle: String
    $ogDescription: String
    $ogUrl: String
    $ogImage: String
    $ogLocale: String
    $ogPublisher: String
    $twTitle: String
    $twDescription: String
    $twUrl: String
    $twCard: String
    $twSite: String
    $twImage: String
    $twImageWidth: String
    $twImageHeight: String
  ) {
    updateDashboardSeo(
      community: $community
      seoEnable: $seoEnable
      ogSiteName: $ogSiteName
      ogTitle: $ogTitle
      ogDescription: $ogDescription
      ogUrl: $ogUrl
      ogImage: $ogImage
      ogLocale: $ogLocale
      ogPublisher: $ogPublisher
      twTitle: $twTitle
      twDescription: $twDescription
      twUrl: $twUrl
      twCard: $twCard
      twSite: $twSite
      twImage: $twImage
      twImageWidth: $twImageWidth
      twImageHeight: $twImageHeight
    ) {
      seo {
        seoEnable
      }
    }
  }
`)

export const updateDashboardEnable = graphql(`
  mutation UpdateDashboardEnable(
    $community: String!
    $post: Boolean
    $blog: Boolean
    $kanban: Boolean
    $changelog: Boolean
    $doc: Boolean
    $docLastUpdate: Boolean
    $docReaction: Boolean
    $about: Boolean
    $aboutTechstack: Boolean
    $aboutLocation: Boolean
    $aboutLinks: Boolean
    $aboutMediaReport: Boolean
    $visitorLocationMap: Boolean
  ) {
    updateDashboardEnable(
      community: $community
      post: $post
      blog: $blog
      kanban: $kanban
      changelog: $changelog
      doc: $doc
      docLastUpdate: $docLastUpdate
      docReaction: $docReaction
      about: $about
      aboutTechstack: $aboutTechstack
      aboutLocation: $aboutLocation
      aboutLinks: $aboutLinks
      aboutMediaReport: $aboutMediaReport
      visitorLocationMap: $visitorLocationMap
    ) {
      enable {
        post
        blog
        kanban
        changelog
        doc
        docLastUpdate
        docReaction
        about
        aboutTechstack
        aboutLocation
        aboutLinks
        aboutMediaReport
        visitorLocationMap
      }
    }
  }
`)

export const updateDashboardSocialLinks = graphql(`
  mutation UpdateDashboardSocialLinks($community: String!, $socialLinks: [DsbSocialLinkMap]) {
    updateDashboardSocialLinks(community: $community, socialLinks: $socialLinks) {
      socialLinks {
        type
        link
      }
    }
  }
`)

export const updateDashboardNameAlias = graphql(`
  mutation UpdateDashboardNameAlias($community: String!, $nameAlias: [DsbAliasMap]) {
    updateDashboardNameAlias(community: $community, nameAlias: $nameAlias) {
      nameAlias {
        original
        name
        slug
        group
      }
    }
  }
`)

export const updateDashboardDocFaq = graphql(`
  mutation UpdateDashboardDocFaq($community: String!, $docFaq: DsbDocFaqInput!) {
    updateDashboardDocFaq(community: $community, docFaq: $docFaq) {
      docFaq {
        title
        desc
        groupedView
        groupItems {
          id
          title
          index
          items {
            id
            title
            detail
            index
          }
        }
        flatItems {
          id
          title
          detail
          index
        }
      }
    }
  }
`)

export const updateDashboardHeaderLinks = graphql(`
  mutation UpdateDashboardHeaderLinks($community: String!, $headerLinks: [DsbLinkMap]) {
    updateDashboardHeaderLinks(community: $community, headerLinks: $headerLinks) {
      headerLinks {
        ...DashboardHeaderLinkFields
      }
    }
  }
`)

export const updateDashboardFooterLinks = graphql(`
  mutation UpdateDashboardFooterLinks($community: String!, $footerLinks: [DsbLinkMap]) {
    updateDashboardFooterLinks(community: $community, footerLinks: $footerLinks) {
      footerLinks {
        ...DashboardHeaderLinkFields
      }
    }
  }
`)

export const updateDashboardFooterOnelineLinks = graphql(`
  mutation UpdateDashboardFooterOnelineLinks(
    $community: String!
    $footerOnelineLinks: [DsbLinkChildMap]
  ) {
    updateDashboardFooterOnelineLinks(
      community: $community
      footerOnelineLinks: $footerOnelineLinks
    ) {
      footerOnelineLinks {
        ...DashboardFooterOnelineLinkFields
      }
    }
  }
`)

export default {
  updateDashboardBaseInfo,
  updateDashboardMediaReports,
  updateDashboardThirdPartyAnalytics,
  updateDashboardSeo,
  updateDashboardEnable,
  updateDashboardSocialLinks,
  updateDashboardNameAlias,
  updateDashboardDocFaq,
  updateDashboardHeaderLinks,
  updateDashboardFooterLinks,
  updateDashboardFooterOnelineLinks,
}
