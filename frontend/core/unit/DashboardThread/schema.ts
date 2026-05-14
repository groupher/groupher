import { gql } from 'urql'

import { F, P } from '~/schemas'

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
  mutation ($community: String!, $mediaReports: [DsbMediaReportMap]) {
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
    $pageBg: String
    $pageBgDark: String
    $pageCustomBg: Int
    $pageCustomBgDark: Int
    $pageCustomIntensity: Int
    $pageCustomIntensityDark: Int
    $primaryColor: RainbowColor
    $primaryCustomColor: String
    $primaryCustomColorDark: String
    $subPrimaryColor: RainbowColor
    $subPrimaryCustomColor: String
    $subPrimaryCustomColorDark: String
    $postLayout: DsbPostLayout
    $kanbanLayout: DsbKanbanLayout
    $kanbanCardLayout: DsbKanbanCardLayout
    $kanbanBoards: [KanbanBoard]
    $footerLayout: DsbFooterLayout
    $headerLayout: DsbHeaderLayout
    $topbarEnabled: Boolean
    $topbarBg: RainbowColor
    $topbarBgCustomColor: String
    $tagLayout: DsbTagLayout
    $inlineTagLayout: DsbInlineTagLayout
    $avatarLayout: DsbAvatarLayout
    $navActiveLayout: DsbNavActiveLayout
    $broadcastEnable: Boolean
    $kanbanBgColors: [RainbowColor]
    $broadcastBg: RainbowColor
    $broadcastCustomBg: String
    $broadcastArticleBg: RainbowColor
    $broadcastArticleCustomBg: String
    $glowType: String
    $glowFixed: Boolean
    $glowOpacity: String
    $overlayDark: Boolean
    $gaussBlur: Int
    $gaussBlurDark: Int
    $brandLayout: DsbBrandLayout
    $communityLayout: DsbCommunityLayout
    $changelogLayout: DsbChangelogLayout
    $docCoverLayout: DsbDocCoverLayout
    $docFaqLayout: DsbDocFaqLayout
  ) {
    updateDashboardLayout(
      community: $community
      pageBg: $pageBg
      pageBgDark: $pageBgDark
      pageCustomBg: $pageCustomBg
      pageCustomBgDark: $pageCustomBgDark
      pageCustomIntensity: $pageCustomIntensity
      pageCustomIntensityDark: $pageCustomIntensityDark
      primaryColor: $primaryColor
      primaryCustomColor: $primaryCustomColor
      primaryCustomColorDark: $primaryCustomColorDark
      subPrimaryColor: $subPrimaryColor
      subPrimaryCustomColor: $subPrimaryCustomColor
      subPrimaryCustomColorDark: $subPrimaryCustomColorDark
      postLayout: $postLayout
      kanbanLayout: $kanbanLayout
      kanbanCardLayout: $kanbanCardLayout
      kanbanBoards: $kanbanBoards
      footerLayout: $footerLayout
      headerLayout: $headerLayout
      topbarEnabled: $topbarEnabled
      topbarBg: $topbarBg
      topbarBgCustomColor: $topbarBgCustomColor
      tagLayout: $tagLayout
      inlineTagLayout: $inlineTagLayout
      avatarLayout: $avatarLayout
      navActiveLayout: $navActiveLayout
      broadcastEnable: $broadcastEnable
      broadcastBg: $broadcastBg
      broadcastCustomBg: $broadcastCustomBg
      broadcastArticleBg: $broadcastArticleBg
      broadcastArticleCustomBg: $broadcastArticleCustomBg
      kanbanBgColors: $kanbanBgColors
      glowType: $glowType
      glowFixed: $glowFixed
      glowOpacity: $glowOpacity
      overlayDark: $overlayDark
      gaussBlur: $gaussBlur
      gaussBlurDark: $gaussBlurDark
      brandLayout: $brandLayout
      communityLayout: $communityLayout
      changelogLayout: $changelogLayout
      docCoverLayout: $docCoverLayout
      docFaqLayout: $docFaqLayout
    ) {
      slug
    }
  }
`

const updateDashboardSocialLinks = gql`
  mutation ($community: String!, $socialLinks: [DsbSocialLinkMap]) {
    updateDashboardSocialLinks(community: $community, socialLinks: $socialLinks) {
      slug
    }
  }
`

const updateDashboardNameAlias = gql`
  mutation ($community: String!, $nameAlias: [DsbAliasMap]) {
    updateDashboardNameAlias(community: $community, nameAlias: $nameAlias) {
      slug
    }
  }
`

const communityTagGroups = gql`
  query ($community: String!, $thread: Thread) {
    communityTagGroups(community: $community, thread: $thread) {
      id
      title
      index
      tags {
        ${F.tag}
      }
    }
  }
`
const updateCommunityTag = gql`
  mutation (
    $id: ID!
    $color: RainbowColor
    $title: String
    $slug: String
    $community: String!
    $extra: [String]
    $icon: String
    $groupId: ID
  ) {
    updateCommunityTag(
      id: $id
      color: $color
      title: $title
      slug: $slug
      community: $community
      extra: $extra
      icon: $icon
      groupId: $groupId
    ) {
      id
      title
      slug
      color
      groupId
      extra
      icon
    }
  }
`

const createCommunityTagGroup = gql`
  mutation ($thread: Thread!, $title: String!, $community: String!) {
    createCommunityTagGroup(thread: $thread, title: $title, community: $community) {
      id
      title
      index
      tags {
        ${F.tag}
      }
    }
  }
`

const updateCommunityTagGroup = gql`
  mutation ($id: ID!, $title: String!, $community: String!, $thread: Thread) {
    updateCommunityTagGroup(id: $id, title: $title, community: $community, thread: $thread) {
      id
      title
      index
      tags {
        ${F.tag}
      }
    }
  }
`

const createCommunityTag = gql`
  mutation (
    $thread: Thread!
    $title: String!
    $slug: String!
    $layout: String
    $color: RainbowColor!
    $groupId: ID!
    $community: String!
  ) {
    createCommunityTag(
      thread: $thread
      title: $title
      slug: $slug
      layout: $layout
      color: $color
      groupId: $groupId
      community: $community
    ) {
      id
    }
  }
`

const reindexTagsInGroup = gql`
  mutation ($community: String!, $thread: Thread, $groupId: ID!, $tags: [ReindexTagInput]) {
    reindexTagsInGroup(community: $community, thread: $thread, groupId: $groupId, tags: $tags) {
      done
    }
  }
`

const reindexCommunityTags = gql`
  mutation ($community: String!, $thread: Thread, $tags: [ReindexCommunityTagInput]) {
    reindexCommunityTags(community: $community, thread: $thread, tags: $tags) {
      done
    }
  }
`

const reindexCommunityTagGroups = gql`
  mutation ($community: String!, $thread: Thread, $groups: [ReindexCommunityTagGroupInput]) {
    reindexCommunityTagGroups(community: $community, thread: $thread, groups: $groups) {
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
        isRoot
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

const searchUsers = gql`
  query ($name: String!) {
    searchUsers(name: $name) {
      entries {
        login
        avatar
        nickname
        bio
        social {
          github
          twitter
          zhihu
        }
      }
    }
  }
`

const addModerator = gql`
  mutation ($community: String!, $user: String!) {
    addModerator(community: $community, user: $user) {
      moderators {
        isRoot
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

const addModerators = gql`
  mutation ($community: String!, $users: [String!]!) {
    addModerators(community: $community, users: $users) {
      moderators {
        isRoot
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
  mutation ($community: String!, $headerLinks: [DsbLinkMap]) {
    updateDashboardHeaderLinks(community: $community, headerLinks: $headerLinks) {
      slug
      dashboard {
        headerLinks {
          ${F.headerLink}
        }
      }
    }
  }
`
const updateDashboardFooterLinks = gql`
  mutation ($community: String!, $footerLinks: [DsbLinkMap]) {
    updateDashboardFooterLinks(community: $community, footerLinks: $footerLinks) {
      slug
      dashboard {
        footerLinks {
          ${F.headerLink}
        }
      }
    }
  }
`

const updateDashboardFooterOnelineLinks = gql`
  mutation ($community: String!, $footerOnelineLinks: [DsbLinkChildMap]) {
    updateDashboardFooterOnelineLinks(
      community: $community
      footerOnelineLinks: $footerOnelineLinks
    ) {
      slug
      dashboard {
        footerOnelineLinks {
          ${F.footerOnelineLink}
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
  communityTagGroups,
  updateDashboardEnable,
  updateDashboardLayout,
  updateDashboardSocialLinks,
  updateDashboardNameAlias,
  createCommunityTag,
  createCommunityTagGroup,
  updateCommunityTag,
  updateCommunityTagGroup,
  reindexTagsInGroup,
  reindexCommunityTags,
  reindexCommunityTagGroups,
  pagedPosts,
  pagedChangelogs,
  updateDashboardFaqs,
  updateModerators,
  searchUsers,
  addModerator,
  addModerators,
  communityOverview,
  openGraphInfo,
  updateDashboardHeaderLinks,
  updateDashboardFooterLinks,
  updateDashboardFooterOnelineLinks,
}

export default schema
