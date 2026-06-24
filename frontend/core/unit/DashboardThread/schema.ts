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
  publishState {
    status
    published
    publishedBefore
    publishedNodeId
    publishedDocId
    hasUnpublishedChanges
    lastPublishedAt
    inCover
    hiddenFromCover
    pinnedToCover
  }
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
      insertedAt
      updatedAt
      author {
        login
        nickname
        avatar
      }
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

const docDraftRevisions = gql`
  query docDraftRevisions($community: String!, $id: ID!, $type: ArticleRevisionType) {
    docDraftRevisions(community: $community, id: $id, type: $type) {
      id
      thread
      type
      articleId
      articleDraftId
      title
      slug
      digest
      documentJson
      contentHash
      revisionNumber
      schemaVersion
      insertedAt
      author {
        login
        nickname
        avatar
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
      insertedAt
      updatedAt
      author {
        login
        nickname
        avatar
      }
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

const checkpointDocDraftRevision = gql`
  mutation checkpointDocDraftRevision($community: String!, $id: ID!) {
    checkpointDocDraftRevision(community: $community, id: $id) {
      id
      thread
      type
      articleDraftId
      title
      slug
      documentJson
      contentHash
      revisionNumber
      schemaVersion
      insertedAt
      author {
        login
        nickname
        avatar
      }
    }
  }
`

const publishDocDraftRevision = gql`
  mutation publishDocDraftRevision($community: String!, $id: ID!, $mode: DocPublishMode) {
    publishDocDraftRevision(community: $community, id: $id, mode: $mode) {
      id
      thread
      type
      articleId
      articleDraftId
      title
      slug
      documentJson
      contentHash
      revisionNumber
      schemaVersion
      insertedAt
      author {
        login
        nickname
        avatar
      }
    }
  }
`

const publishAllUnpublishedDocDrafts = gql`
  mutation publishAllUnpublishedDocDrafts($community: String!, $mode: DocPublishMode) {
    publishAllUnpublishedDocDrafts(community: $community, mode: $mode) {
      done
    }
  }
`

const publishDocTreeGroup = gql`
  mutation publishDocTreeGroup($community: String!, $groupId: ID!, $mode: DocPublishMode) {
    publishDocTreeGroup(community: $community, groupId: $groupId, mode: $mode) {
      done
    }
  }
`

const moveDocToDraft = gql`
  mutation moveDocToDraft($community: String!, $id: ID!) {
    moveDocToDraft(community: $community, id: $id) {
      done
    }
  }
`

const moveDocTreeGroupToDraft = gql`
  mutation moveDocTreeGroupToDraft($community: String!, $groupId: ID!) {
    moveDocTreeGroupToDraft(community: $community, groupId: $groupId) {
      done
    }
  }
`

const restoreDocDraftRevision = gql`
  mutation restoreDocDraftRevision($community: String!, $id: ID!, $revisionId: ID!) {
    restoreDocDraftRevision(community: $community, id: $id, revisionId: $revisionId) {
      id
      title
      slug
      digest
      insertedAt
      updatedAt
      author {
        login
        nickname
        avatar
      }
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
    $targetIndex: Int
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

const addDocCoverGroup = gql`
  mutation addDocCoverGroup($community: String!, $groupId: ID!) {
    addDocCoverGroup(community: $community, groupId: $groupId) {
      id
      groupId
      index
      uiConfig
    }
  }
`

const removeDocCoverGroup = gql`
  mutation removeDocCoverGroup($community: String!, $groupId: ID!) {
    removeDocCoverGroup(community: $community, groupId: $groupId) {
      id
      groupId
      index
      uiConfig
    }
  }
`

const setDocCoverItemHidden = gql`
  mutation setDocCoverItemHidden($community: String!, $nodeId: ID!, $hidden: Boolean!) {
    setDocCoverItemHidden(community: $community, nodeId: $nodeId, hidden: $hidden) {
      id
      nodeId
      hidden
    }
  }
`

const reorderDocCoverGroups = gql`
  mutation reorderDocCoverGroups($community: String!, $ids: [ID!]!) {
    reorderDocCoverGroups(community: $community, ids: $ids) {
      done
    }
  }
`

const reorderDocCoverItems = gql`
  mutation reorderDocCoverItems($community: String!, $coverGroupId: ID!, $ids: [ID!]!) {
    reorderDocCoverItems(community: $community, coverGroupId: $coverGroupId, ids: $ids) {
      done
    }
  }
`

const pinDocCoverItem = gql`
  mutation pinDocCoverItem($community: String!, $nodeId: ID!, $uiConfig: Json) {
    pinDocCoverItem(community: $community, nodeId: $nodeId, uiConfig: $uiConfig) {
      id
      nodeId
      uiConfig
    }
  }
`

const unpinDocCoverItem = gql`
  mutation unpinDocCoverItem($community: String!, $nodeId: ID!) {
    unpinDocCoverItem(community: $community, nodeId: $nodeId) {
      id
      nodeId
    }
  }
`

const updateDocCoverGroupUiConfig = gql`
  mutation updateDocCoverGroupUiConfig($community: String!, $id: ID!, $uiConfig: Json!) {
    updateDocCoverGroupUiConfig(community: $community, id: $id, uiConfig: $uiConfig) {
      id
      uiConfig
    }
  }
`

const updateDocCoverItemUiConfig = gql`
  mutation updateDocCoverItemUiConfig($community: String!, $id: ID!, $uiConfig: Json!) {
    updateDocCoverItemUiConfig(community: $community, id: $id, uiConfig: $uiConfig) {
      id
      uiConfig
    }
  }
`

const updateDocCoverPinnedUiConfig = gql`
  mutation updateDocCoverPinnedUiConfig($community: String!, $nodeId: ID!, $uiConfig: Json!) {
    updateDocCoverPinnedUiConfig(community: $community, nodeId: $nodeId, uiConfig: $uiConfig) {
      id
      nodeId
      uiConfig
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
  docDraftRevisions,
  createDocTreeGroup,
  createDocTreePage,
  createDocTreeLink,
  updateDocTreeNode,
  updateDocDraft,
  checkpointDocDraftRevision,
  publishDocDraftRevision,
  publishAllUnpublishedDocDrafts,
  publishDocTreeGroup,
  moveDocToDraft,
  moveDocTreeGroupToDraft,
  restoreDocDraftRevision,
  deleteDocTreeNode,
  duplicateDocTreeNode,
  moveDocTreeNode,
  addDocCoverGroup,
  removeDocCoverGroup,
  setDocCoverItemHidden,
  reorderDocCoverGroups,
  reorderDocCoverItems,
  pinDocCoverItem,
  unpinDocCoverItem,
  updateDocCoverGroupUiConfig,
  updateDocCoverItemUiConfig,
  updateDocCoverPinnedUiConfig,
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
