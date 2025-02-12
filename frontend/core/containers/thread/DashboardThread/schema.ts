import { gql } from 'urql'
import { P, F } from '~/schemas'

const { pagedPosts, pagedChangelogs } = P

const communityBaseInfo = gql`
  query community($slug: String!, $incViews: Boolean) {
    community(slug: $slug, incViews: $incViews) {
      dashboard {
        baseInfo {
          title
          locale
          favicon
          logo
          slug
          desc
          introduction
          homepage
          city
          techstack
        }
        mediaReports {
          url
          title
          siteName
          favicon
          index
        }
      }
    }
  }
`

const communitySocialLinks = gql`
  query community($slug: String!, $incViews: Boolean) {
    community(slug: $slug, incViews: $incViews) {
      dashboard {
        baseInfo {
          socialLinks {
            type
            link
          }
        }
      }
    }
  }
`

const updateDashboardBaseInfo = gql`
  mutation (
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
      title
      logo
      favicon
      locale
    }
  }
`
const updateDashboardMediaReports = gql`
  mutation ($community: String!, $mediaReports: [DashboardMediaReportMap]) {
    updateDashboardMediaReports(community: $community, mediaReports: $mediaReports) {
      title
      dashboard {
        mediaReports {
          index
          title
          url
          favicon
          siteName
        }
      }
    }
  }
`
const updateDashboardSeo = gql`
  mutation (
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
      slug
      dashboard {
        seo {
          seoEnable
        }
      }
    }
  }
`
const updateDashboardEnable = gql`
  mutation ($community: String!, $post: Boolean, $changelog: Boolean, $about: Boolean) {
    updateDashboardEnable(
      community: $community
      post: $post
      changelog: $changelog
      about: $about
    ) {
      slug
    }
  }
`

const updateDashboardLayout = gql`
  mutation (
    $community: String!
    $primaryColor: String
    $postLayout: String
    $kanbanLayout: String
    $kanbanCardLayout: String
    $footerLayout: String
    $headerLayout: String
    $topbarLayout: String
    $topbarBg: String
    $tagLayout: String
    $avatarLayout: String
    $broadcastEnable: Boolean
    $kanbanBgColors: [String]
    $glowType: String
    $glowFixed: Boolean
    $glowOpacity: String
    $gossBlur: Int
    $gossBlurDark: Int
    $brandLayout: String
    $bannerLayout: String
    $changelogLayout: String
    $docLayout: String
    $docFaqLayout: String
  ) {
    updateDashboardLayout(
      community: $community
      primaryColor: $primaryColor
      postLayout: $postLayout
      kanbanLayout: $kanbanLayout
      kanbanCardLayout: $kanbanCardLayout
      footerLayout: $footerLayout
      headerLayout: $headerLayout
      topbarLayout: $topbarLayout
      topbarBg: $topbarBg
      tagLayout: $tagLayout
      avatarLayout: $avatarLayout
      broadcastEnable: $broadcastEnable
      kanbanBgColors: $kanbanBgColors
      glowType: $glowType
      glowFixed: $glowFixed
      glowOpacity: $glowOpacity
      gossBlur: $gossBlur
      gossBlurDark: $gossBlurDark
      brandLayout: $brandLayout
      bannerLayout: $bannerLayout
      changelogLayout: $changelogLayout
      docLayout: $docLayout
      docFaqLayout: $docFaqLayout
    ) {
      slug
    }
  }
`

const updateDashboardSocialLinks = gql`
  mutation($community: String!, $socialLinks: [DashboardSocialLinkMap]) {
    updateDashboardSocialLinks(community: $community, socialLinks: $socialLinks) {
      slug
    }
  }
`

const updateDashboardNameAlias = gql`
  mutation ($community: String!, $nameAlias: [DashboardAliasMap]) {
    updateDashboardNameAlias(community: $community, nameAlias: $nameAlias) {
      slug
    }
  }
`

const pagedArticleTags = gql`
  query ($filter: ArticleTagsFilter) {
    pagedArticleTags(filter: $filter) {
      entries {
        ${F.tag}
      }
      totalCount
    }
  }
`

const updateArticleTag = gql`
  mutation (
    $id: ID!
    $color: RainbowColor
    $title: String
    $slug: String
    $community: String!
    $extra: [String]
    $icon: String
    $group: String
  ) {
    updateArticleTag(
      id: $id
      color: $color
      title: $title
      slug: $slug
      community: $community
      extra: $extra
      icon: $icon
      group: $group
    ) {
      id
      title
      color
      group
      extra
      icon
    }
  }
`

const reindexTagsInGroup = gql`
  mutation ($community: String!, $thread: Thread, $group: String!, $tags: [ArticleTagIndex]) {
    reindexTagsInGroup(community: $community, thread: $thread, group: $group, tags: $tags) {
      done
    }
  }
`

const updateDashboardFaqs = gql`
  mutation ($community: String!, $faqs: [dashboardFaqMap]) {
    updateDashboardFaqs(community: $community, faqs: $faqs) {
      title
      dashboard {
        faqs {
          title
          body
          index
        }
      }
    }
  }
`

const updateModerators = gql`
  query community($slug: String!, $incViews: Boolean) {
    community(slug: $slug, incViews: $incViews) {
      moderators {
        role
        passportItemCount
        user {
          login
          avatar
          nickname
          bio
        }
      }
    }
  }
`

const communityOverview = gql`
  query community($slug: String!, $incViews: Boolean) {
    community(slug: $slug, incViews: $incViews) {
      views
      subscribersCount
      meta {
        postsCount
        changelogsCount
        docsCount
      }
    }
  }
`

const updateDashboardHeaderLinks = gql`
  mutation ($community: String!, $headerLinks: [DashboardLinkMap]) {
    updateDashboardHeaderLinks(community: $community, headerLinks: $headerLinks) {
      slug
      dashboard {
        headerLinks {
          ${F.customLink}
        }
      }
    }
  }
`
const updateDashboardFooterLinks = gql`
  mutation ($community: String!, $footerLinks: [DashboardLinkMap]) {
    updateDashboardFooterLinks(community: $community, footerLinks: $footerLinks) {
      slug
      dashboard {
        footerLinks {
          ${F.customLink}
        }
      }
    }
  }
`

const openGraphInfo = gql`
  query ($url: String!) {
    openGraphInfo(url: $url) {
      title
      favicon
      url
      siteName
    }
  }
`

const schema = {
  communityBaseInfo,
  communitySocialLinks,

  updateDashboardBaseInfo,
  updateDashboardMediaReports,
  updateDashboardSeo,
  pagedArticleTags,
  updateDashboardEnable,
  updateDashboardLayout,
  updateDashboardSocialLinks,
  updateDashboardNameAlias,
  updateArticleTag,
  reindexTagsInGroup,
  pagedPosts,
  pagedChangelogs,
  updateDashboardFaqs,
  updateModerators,
  communityOverview,
  openGraphInfo,
  updateDashboardHeaderLinks,
  updateDashboardFooterLinks,
}

export default schema
