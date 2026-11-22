import { graphql } from '~/graphql/authoring'

export const updateDashboardBaseInfo = graphql(`
  "Update base info in dashboard"
  mutation UpdateDashboardBaseInfo(
    $community: String!
    $commandId: ID!
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
      commandId: $commandId
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
  "Update media reports in dashboard"
  mutation UpdateDashboardMediaReports(
    $community: String!
    $commandId: ID!
    $mediaReports: [DsbMediaReportMap]
  ) {
    updateDashboardMediaReports(
      community: $community
      commandId: $commandId
      mediaReports: $mediaReports
    ) {
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
  "Update third-party analytics integrations in dashboard"
  mutation UpdateDashboardThirdPartyAnalytics(
    $community: String!
    $commandId: ID!
    $thirdPartyAnalytics: [DsbThirdPartyAnalyticsInput]
  ) {
    updateDashboardThirdPartyAnalytics(
      community: $community
      commandId: $commandId
      thirdPartyAnalytics: $thirdPartyAnalytics
    ) {
      thirdPartyAnalytics {
        ...DashboardThirdPartyAnalyticsFields
      }
    }
  }
`)

export const updateDashboardSeo = graphql(`
  "Update seo in dashboard"
  mutation UpdateDashboardSeo(
    $community: String!
    $commandId: ID!
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
      commandId: $commandId
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
  "Update enable in dashboard"
  mutation UpdateDashboardEnable(
    $community: String!
    $commandId: ID!
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
      commandId: $commandId
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
  "Update social links in dashboard"
  mutation UpdateDashboardSocialLinks(
    $community: String!
    $commandId: ID!
    $socialLinks: [DsbSocialLinkMap]
  ) {
    updateDashboardSocialLinks(
      community: $community
      commandId: $commandId
      socialLinks: $socialLinks
    ) {
      socialLinks {
        type
        link
      }
    }
  }
`)

export const updateDashboardNameAlias = graphql(`
  "Update name alias in dashboard"
  mutation UpdateDashboardNameAlias(
    $community: String!
    $commandId: ID!
    $nameAlias: [DsbAliasMap]
  ) {
    updateDashboardNameAlias(community: $community, commandId: $commandId, nameAlias: $nameAlias) {
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
  mutation UpdateDashboardDocFaq($community: String!, $commandId: ID!, $docFaq: DsbDocFaqInput!) {
    updateDashboardDocFaq(community: $community, commandId: $commandId, docFaq: $docFaq) {
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
  "Update header links in dashboard"
  mutation UpdateDashboardHeaderLinks(
    $community: String!
    $commandId: ID!
    $headerLinks: [DsbLinkMap]
  ) {
    updateDashboardHeaderLinks(
      community: $community
      commandId: $commandId
      headerLinks: $headerLinks
    ) {
      headerLinks {
        ...DashboardHeaderLinkFields
      }
    }
  }
`)

export const updateDashboardFooterLinks = graphql(`
  "Update footer links in dashboard"
  mutation UpdateDashboardFooterLinks(
    $community: String!
    $commandId: ID!
    $footerLinks: [DsbLinkMap]
  ) {
    updateDashboardFooterLinks(
      community: $community
      commandId: $commandId
      footerLinks: $footerLinks
    ) {
      footerLinks {
        ...DashboardHeaderLinkFields
      }
    }
  }
`)

export const updateDashboardFooterOnelineLinks = graphql(`
  "Update footer oneline links in dashboard"
  mutation UpdateDashboardFooterOnelineLinks(
    $community: String!
    $commandId: ID!
    $footerOnelineLinks: [DsbLinkChildMap]
  ) {
    updateDashboardFooterOnelineLinks(
      community: $community
      commandId: $commandId
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

export const updateDashboardPagiMode = graphql(`
  "Updates the community-wide list interaction preference"
  mutation UpdateDashboardPagiMode(
    $community: String!
    $mode: PagiMode!
    $mobileMode: PagiMode!
    $expectedRevision: Int!
    $commandId: ID!
  ) {
    updateDashboardPagiMode(
      community: $community
      mode: $mode
      mobileMode: $mobileMode
      expectedRevision: $expectedRevision
      commandId: $commandId
    ) {
      pagiMode
      pagiMobileMode
      pagiRevision
    }
  }
`)
