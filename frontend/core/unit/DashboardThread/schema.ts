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
      baseInfo {
        title
        logo
        favicon
        locale
      }
    }
  }
`
const updateDashboardMediaReports = gql`
  mutation ($community: String!, $mediaReports: [DsbMediaReportMap]) {
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
      seo {
        seoEnable
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
      enable {
        post
        changelog
        about
      }
    }
  }
`

const updateDashboardLayout = gql`
  mutation (
    $community: String!
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
    $broadcastLayout: DsbBroadcastLayout
    $broadcastBg: RainbowColor
    $broadcastCustomBg: String
    $broadcastArticleLayout: DsbBroadcastArticleLayout
    $broadcastArticleBg: RainbowColor
    $broadcastArticleCustomBg: String
    $broadcastArticleEnable: Boolean
    $overlayDark: Boolean
    $brandLayout: DsbBrandLayout
    $communityLayout: DsbCommunityLayout
    $changelogLayout: DsbChangelogLayout
    $docCoverLayout: DsbDocCoverLayout
    $docFaqLayout: DsbDocFaqLayout
  ) {
    updateDashboardLayout(
      community: $community
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
      broadcastLayout: $broadcastLayout
      broadcastBg: $broadcastBg
      broadcastCustomBg: $broadcastCustomBg
      broadcastArticleLayout: $broadcastArticleLayout
      broadcastArticleBg: $broadcastArticleBg
      broadcastArticleCustomBg: $broadcastArticleCustomBg
      broadcastArticleEnable: $broadcastArticleEnable
      kanbanBgColors: $kanbanBgColors
      overlayDark: $overlayDark
      brandLayout: $brandLayout
      communityLayout: $communityLayout
      changelogLayout: $changelogLayout
      docCoverLayout: $docCoverLayout
      docFaqLayout: $docFaqLayout
    ) {
      layout {
        postLayout
        kanbanLayout
        kanbanCardLayout
        kanbanBoards
        kanbanBgColors
        docCoverLayout
        docFaqLayout
        tagLayout
        inlineTagLayout
        avatarLayout
        brandLayout
        communityLayout
        navActiveLayout
        topbarEnabled
        topbarBg
        topbarBgCustomColor
        broadcastLayout
        broadcastBg
        broadcastCustomBg
        broadcastEnable
        broadcastArticleLayout
        broadcastArticleBg
        broadcastArticleCustomBg
        broadcastArticleEnable
        changelogLayout
        footerLayout
        headerLayout
        overlayDark
      }
    }
  }
`

const updateDashboardSocialLinks = gql`
  mutation ($community: String!, $socialLinks: [DsbSocialLinkMap]) {
    updateDashboardSocialLinks(community: $community, socialLinks: $socialLinks) {
      socialLinks {
        type
        link
      }
    }
  }
`

const updateDashboardNameAlias = gql`
  mutation ($community: String!, $nameAlias: [DsbAliasMap]) {
    updateDashboardNameAlias(community: $community, nameAlias: $nameAlias) {
      nameAlias {
        original
        name
        slug
        group
      }
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
    $marker: MarkerInput
    $groupId: ID
  ) {
    updateCommunityTag(
      id: $id
      color: $color
      title: $title
      slug: $slug
      community: $community
      extra: $extra
      marker: $marker
      groupId: $groupId
    ) {
      id
      title
      slug
      color
      groupId
      extra
      marker {
        type
        provider
        name
        src
        unified
      }
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
    $marker: MarkerInput
  ) {
    createCommunityTag(
      thread: $thread
      title: $title
      slug: $slug
      layout: $layout
      color: $color
      groupId: $groupId
      community: $community
      marker: $marker
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

const updateDashboardDocFaq = gql`
  mutation ($community: String!, $docFaq: DsbDocFaqInput!) {
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
`

const docTreeNodeFields = `
  id
  parentId
  docId
  type
  title
  slug
  index
  href
  marker {
    type
    provider
    name
    src
    unified
  }
  badge
  hidden
  expanded
`

const docTree = gql`
  query docTree($community: String!) {
    docTree(community: $community) {
      revision
      groups {
        ${docTreeNodeFields}
        children {
          ${docTreeNodeFields}
        }
      }
    }
  }
`

const docDraft = gql`
  query docDraft($community: String!, $id: ID!) {
    docDraft(community: $community, id: $id) {
      id
      title
      slug
      digest
      document {
        json
        markdown
        markdownToc
        html
        xml
        rss
      }
    }
  }
`

const docTreeMutationPayload = `
  revision
  conflict
  node {
    ${docTreeNodeFields}
  }
  affectedNodes {
    ${docTreeNodeFields}
  }
`

const createDocTreeGroup = gql`
  mutation ($community: String!, $baseRevision: Int!, $input: DocTreeNodeInput!) {
    createDocTreeGroup(community: $community, baseRevision: $baseRevision, input: $input) {
      ${docTreeMutationPayload}
    }
  }
`

const createDocTreePage = gql`
  mutation ($community: String!, $baseRevision: Int!, $input: DocTreeNodeInput!) {
    createDocTreePage(community: $community, baseRevision: $baseRevision, input: $input) {
      ${docTreeMutationPayload}
    }
  }
`

const createDocTreeLink = gql`
  mutation ($community: String!, $baseRevision: Int!, $input: DocTreeNodeInput!) {
    createDocTreeLink(community: $community, baseRevision: $baseRevision, input: $input) {
      ${docTreeMutationPayload}
    }
  }
`

const updateDocTreeNode = gql`
  mutation (
    $community: String!
    $id: ID!
    $baseRevision: Int!
    $patch: DocTreeNodePatchInput!
  ) {
    updateDocTreeNode(community: $community, id: $id, baseRevision: $baseRevision, patch: $patch) {
      ${docTreeMutationPayload}
    }
  }
`

const updateDocDraft = gql`
  mutation ($community: String!, $id: ID!, $title: String, $slug: String, $body: String) {
    updateDocDraft(community: $community, id: $id, title: $title, slug: $slug, body: $body) {
      id
      title
      slug
      digest
      document {
        json
        markdown
        markdownToc
        html
        xml
        rss
      }
    }
  }
`

const deleteDocTreeNode = gql`
  mutation ($community: String!, $id: ID!, $baseRevision: Int!) {
    deleteDocTreeNode(community: $community, id: $id, baseRevision: $baseRevision) {
      ${docTreeMutationPayload}
    }
  }
`

const duplicateDocTreeNode = gql`
  mutation ($community: String!, $id: ID!, $baseRevision: Int!) {
    duplicateDocTreeNode(community: $community, id: $id, baseRevision: $baseRevision) {
      ${docTreeMutationPayload}
    }
  }
`

const moveDocTreeNode = gql`
  mutation (
    $community: String!
    $id: ID!
    $baseRevision: Int!
    $targetParentId: ID
    $targetIndex: Int!
  ) {
    moveDocTreeNode(
      community: $community
      id: $id
      baseRevision: $baseRevision
      targetParentId: $targetParentId
      targetIndex: $targetIndex
    ) {
      ${docTreeMutationPayload}
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
      headerLinks {
        ${F.headerLink}
      }
    }
  }
`
const updateDashboardFooterLinks = gql`
  mutation ($community: String!, $footerLinks: [DsbLinkMap]) {
    updateDashboardFooterLinks(community: $community, footerLinks: $footerLinks) {
      footerLinks {
        ${F.headerLink}
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
      footerOnelineLinks {
        ${F.footerOnelineLink}
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
  updateDashboardDocFaq,
  docTree,
  docDraft,
  createDocTreeGroup,
  createDocTreePage,
  createDocTreeLink,
  updateDocTreeNode,
  updateDocDraft,
  deleteDocTreeNode,
  duplicateDocTreeNode,
  moveDocTreeNode,
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
