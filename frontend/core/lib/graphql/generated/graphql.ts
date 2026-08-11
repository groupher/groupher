/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
export type AnalysisTrendEnvironmentDimension = 'BROWSER' | 'DEVICE' | 'LANGUAGE' | 'OS' | 'SCREEN'

export type AnalysisTrendLocationDimension = 'CITY' | 'COUNTRY' | 'REGION'

export type AnalysisTrendPagesDimension = 'ENTRY' | 'EXIT' | 'PATH' | 'QUERY' | 'TITLE'

export type AnalysisTrendSourcesDimension = 'CHANNEL' | 'DOMAIN' | 'REFERRER'

export type ArticleCatEnum = 'BUG' | 'DISCUSSION' | 'IDEA' | 'QA'

export type ArticleDocumentAssetUsage = 'ATTACHMENT' | 'COVER' | 'COVER_DARK' | 'EMBED' | 'INLINE'

export type ArticleOrderEnum = 'COMMENTS' | 'PUBLISH' | 'UPVOTES' | 'VIEWS'

export type ArticlePathInput = {
  community: string
  innerId: string | number
  thread: Thread
}

export type ArticleSnapshotAction = 'CHECKPOINT' | 'FORK' | 'PROMOTE' | 'PUBLISH' | 'RESTORE'

export type ArticleSnapshotStage = 'DRAFT' | 'PUBLIC'

export type ArticleStatusEnum =
  | 'BACKLOG'
  | 'DEFAULT'
  | 'DONE'
  | 'REJECT'
  | 'REJECT_DUP'
  | 'REJECT_NO_PLAN'
  | 'REJECT_REPRO'
  | 'REJECT_STALE'
  | 'RESOLVED'
  | 'TODO'
  | 'WIP'

export type ArtimentBodyBagInput = {
  bodyHash: string
  digest: string
  html: string
  json: string
  markdown: string
  plainText: string
  schemaVersion: number
  toc: Array<ArtimentTocItemInput>
}

export type ArtimentTocItemInput = {
  id: string
  level: number
  title: string
}

/** emotion options of comment */
export type CommentEmotion =
  | 'BEER'
  | 'BICEPS'
  | 'CONFUSED'
  | 'DOWNVOTE'
  | 'HEART'
  | 'ORZ'
  | 'PILL'
  | 'POPCORN'

export type CommentPathInput = {
  article: ArticlePathInput
  innerId: string | number
}

export type CommentsFilter = {
  page?: number | null | undefined
  size?: number | null | undefined
  sort?: InsertedSortEnum | null | undefined
}

/** the filter mode for list comments */
export type CommentsMode = 'REPLIES' | 'TIMELINE'

export type CommunitiesFilter = {
  category?: string | null | undefined
  /** limit of records (default 20), if first > 30, only return 30 at most */
  page?: number | null | undefined
  size?: number | null | undefined
  sort?: SortEnum | null | undefined
}

export type CommunityAssetFilter = {
  assetType?: CommunityAssetType | null | undefined
  page?: number | null | undefined
  query?: string | null | undefined
  size?: number | null | undefined
  subtypes?: Array<string> | null | undefined
  thread?: Thread | null | undefined
}

export type CommunityAssetStatus = 'ACTIVE' | 'DELETED'

export type CommunityAssetType = 'AUDIO' | 'FILE' | 'IMAGE' | 'VIDEO'

export type CommunityAssetUploadFileInput = {
  assetType?: CommunityAssetType | null | undefined
  checksumSha256?: string | null | undefined
  filename: string
  mimeType: string
  sizeBytes: unknown
  thread?: Thread | null | undefined
}

export type ContentImportJobStatus =
  | 'APPLYING'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'FAILED'
  | 'READY'
  | 'STAGING'

export type ContentImportProcessItemState = 'COMPLETED' | 'FAILED' | 'SKIPPED'

export type ContentImportProcessStage = 'ANALYZING' | 'APPLYING' | 'BUILDING_PREVIEW' | 'PREPARING'

export type ContentImportProcessState = 'COMPLETED' | 'FAILED' | 'QUEUED' | 'RUNNING'

export type ContentImportProcessUnit = 'COMMENT' | 'DISCUSSION' | 'DOCUMENT' | 'POST' | 'RELEASE'

export type DocCoverView = 'DASHBOARD' | 'PUBLIC'

export type DocPublishChangesInput = {
  docChangeIds?: Array<string | number | null | undefined> | null | undefined
  restoreTreeChangeIds?: Array<string | number | null | undefined> | null | undefined
  treeChangeIds?: Array<string | number | null | undefined> | null | undefined
}

export type DocPublishMode = 'DOC_ONLY' | 'WITH_COVER_SYNC'

export type DocPublishStatus = 'DRAFT' | 'PUBLIC'

export type DocTreeNodeInput = {
  badge?: string | null | undefined
  docId?: string | number | null | undefined
  hidden?: boolean | null | undefined
  href?: string | null | undefined
  index?: number | null | undefined
  marker?: MarkerInput | null | undefined
  title: string
  type: DocTreeNodeType
}

export type DocTreeNodePatchInput = {
  badge?: string | null | undefined
  hidden?: boolean | null | undefined
  href?: string | null | undefined
  marker?: MarkerInput | null | undefined
  title?: string | null | undefined
}

export type DocTreeNodeType = 'GROUP' | 'LINK' | 'PAGE' | 'PIN' | 'TAB'

export type DsbAliasMap = {
  group?: string | null | undefined
  name?: string | null | undefined
  original?: string | null | undefined
  slug?: string | null | undefined
}

export type DsbAvatarLayout = 'CIRCLE' | 'SQUARE'

export type DsbBgConfigInput = {
  contentShadow?: unknown
  effect?: unknown
  gradient?: unknown
  pattern?: unknown
  source?: string | null | undefined
  texture?: unknown
  type?: string | null | undefined
}

export type DsbBrandLayout = 'BOTH' | 'LOGO' | 'TEXT'

export type DsbBroadcastArticleLayout = 'DEFAULT' | 'SIMPLE'

export type DsbBroadcastLayout = 'CENTER' | 'DEFAULT'

export type DsbChangelogLayout = 'CLASSIC' | 'SIMPLE'

export type DsbCommunityLayout = 'CLASSIC' | 'HERO' | 'SIDEBAR'

export type DsbDocCoverLayout =
  | 'BRIEF_CARDS'
  | 'COVER_CARDS'
  | 'OUTLINE_COLUMNS'
  | 'OUTLINE_TOC'
  | 'STACK_CARDS'
  | 'TILE_CARDS'

export type DsbDocFaqGroupInput = {
  id?: string | null | undefined
  index?: number | null | undefined
  items?: Array<DsbDocFaqItemInput | null | undefined> | null | undefined
  title?: string | null | undefined
}

export type DsbDocFaqInput = {
  desc?: string | null | undefined
  flatItems?: Array<DsbDocFaqItemInput | null | undefined> | null | undefined
  groupItems?: Array<DsbDocFaqGroupInput | null | undefined> | null | undefined
  groupedView?: boolean | null | undefined
  title?: string | null | undefined
}

export type DsbDocFaqItemInput = {
  detail?: string | null | undefined
  id?: string | null | undefined
  index?: number | null | undefined
  title?: string | null | undefined
}

export type DsbDocFaqLayout = 'COLLAPSE' | 'FLAT' | 'LEFT_RIGHT' | 'SEARCH_HINT'

export type DsbFooterLayout = 'GROUP' | 'ONELINE'

export type DsbHeaderLayout = 'CENTER' | 'FLOAT' | 'RIGHT'

export type DsbInlineTagLayout = 'BORDER' | 'MORANDI' | 'SIMPLE' | 'SOFT' | 'SOLID'

export type DsbKanbanCardLayout = 'FULL' | 'SIMPLE'

export type DsbKanbanLayout = 'CLASSIC' | 'WATERFALL'

export type DsbLinkChildMap = {
  id: string
  title: string
  url: string
}

export type DsbLinkMap = {
  id: string
  links?: Array<DsbLinkChildMap | null | undefined> | null | undefined
  title: string
  type: DsbLinkType
  url?: string | null | undefined
}

export type DsbLinkType = 'GROUP' | 'LINK'

export type DsbMediaReportMap = {
  description?: string | null | undefined
  favicon?: string | null | undefined
  index?: number | null | undefined
  siteName?: string | null | undefined
  title?: string | null | undefined
  url?: string | null | undefined
}

export type DsbNavActiveLayout = 'GRAY_BG' | 'SOFT_BG' | 'TEXT'

export type DsbPostLayout = 'COVER' | 'MASONRY' | 'MINIMAL' | 'PH' | 'QUORA'

export type DsbSocialLinkMap = {
  link?: string | null | undefined
  type?: string | null | undefined
}

export type DsbTagLayout = 'DOT' | 'HASH' | 'ICON'

export type DsbThemePreset = 'CLAUDE' | 'CUSTOM' | 'DEFAULT' | 'HN' | 'SOLARIZED'

export type DsbThirdPartyAnalyticsInput = {
  containerId?: string | null | undefined
  domain?: string | null | undefined
  enabled?: boolean | null | undefined
  measurementId?: string | null | undefined
  projectId?: string | null | undefined
  provider?: string | null | undefined
  siteId?: string | null | undefined
}

export type DsbWallpaperInput = {
  dark?: DsbBgConfigInput | null | undefined
  light?: DsbBgConfigInput | null | undefined
}

/** emotion options used by API output */
export type EmotionType =
  | 'BEER'
  | 'BICEPS'
  | 'CONFUSED'
  | 'DOWNVOTE'
  | 'HEART'
  | 'ORZ'
  | 'PILL'
  | 'POPCORN'
  | 'UPVOTE'

export type InsertedSortEnum = 'ASC_INSERTED' | 'DESC_INSERTED'

export type KanbanBoard = 'BACKLOG' | 'DONE' | 'REJECTED' | 'TODO' | 'WIP'

export type MarkerAppearanceInput = {
  dark: MarkerThemeAppearanceInput
  light: MarkerThemeAppearanceInput
}

export type MarkerInput = {
  appearance?: MarkerAppearanceInput | null | undefined
  name?: string | null | undefined
  provider?: string | null | undefined
  src?: string | null | undefined
  type: MarkerType
  unified?: string | null | undefined
}

export type MarkerThemeAppearanceInput = {
  bg?: string | null | undefined
  color?: string | null | undefined
}

export type MarkerType = 'EMOJI' | 'ICON'

/** changelogs_filter doc */
export type PagedChangelogsFilter = {
  author?: string | null | undefined
  cat?: ArticleCatEnum | null | undefined
  community?: string | null | undefined
  communityTag?: string | null | undefined
  communityTags?: Array<string | null | undefined> | null | undefined
  order?: ArticleOrderEnum | null | undefined
  /** limit of records (default 20), if first > 30, only return 30 at most */
  page?: number | null | undefined
  size?: number | null | undefined
  sort?: SortEnum | null | undefined
  status?: ArticleStatusEnum | null | undefined
  when?: WhenEnum | null | undefined
}

/** docs_filter doc */
export type PagedDocsFilter = {
  author?: string | null | undefined
  cat?: ArticleCatEnum | null | undefined
  community?: string | null | undefined
  communityTag?: string | null | undefined
  communityTags?: Array<string | null | undefined> | null | undefined
  order?: ArticleOrderEnum | null | undefined
  /** limit of records (default 20), if first > 30, only return 30 at most */
  page?: number | null | undefined
  size?: number | null | undefined
  sort?: SortEnum | null | undefined
  status?: ArticleStatusEnum | null | undefined
  when?: WhenEnum | null | undefined
}

/** posts_filter doc */
export type PagedPostsFilter = {
  author?: string | null | undefined
  cat?: ArticleCatEnum | null | undefined
  community?: string | null | undefined
  communityTag?: string | null | undefined
  communityTags?: Array<string | null | undefined> | null | undefined
  order?: ArticleOrderEnum | null | undefined
  /** limit of records (default 20), if first > 30, only return 30 at most */
  page?: number | null | undefined
  size?: number | null | undefined
  sort?: SortEnum | null | undefined
  status?: ArticleStatusEnum | null | undefined
  when?: WhenEnum | null | undefined
}

export type PagiFilter = {
  /** limit of records (default 20), if first > 30, only return 30 at most */
  page?: number | null | undefined
  size?: number | null | undefined
  sort?: SortEnum | null | undefined
}

export type PressFeedType = 'DIGEST' | 'FULL'

export type RainbowColor =
  | 'BLACK'
  | 'BLUE'
  | 'BROWN'
  | 'CUSTOM'
  | 'CYAN'
  | 'CYAN_LIGHT'
  | 'GREEN'
  | 'GREEN_LIGHT'
  | 'ORANGE'
  | 'PINK'
  | 'PURPLE'
  | 'RED'
  | 'YELLOW'

export type ReindexCommunityTagGroupInput = {
  id: string | number
  index: number
}

export type ReindexCommunityTagInput = {
  groupId: string | number
  id: string | number
  index: number
}

export type ReindexTagInput = {
  id?: string | number | null | undefined
  index?: number | null | undefined
}

export type SortEnum =
  | 'ASC_ACTIVE'
  | 'DESC_ACTIVE'
  | 'DESC_INSERTED'
  | 'LEAST_STARS'
  | 'LEAST_VIEWS'
  | 'MOST_STARS'
  | 'MOST_VIEWS'

export type Thread =
  | 'ABOUT'
  | 'ACCOUNT'
  | 'BLOG'
  | 'CHANGELOG'
  | 'DASHBOARD'
  | 'DOC'
  | 'KANBAN'
  | 'POST'
  | 'USER'

export type UpdatePressConfigInput = {
  community: string
  feedCount?: number | null | undefined
  feedEnabled?: boolean | null | undefined
  feedThreads?: Array<Thread> | null | undefined
  feedType?: PressFeedType | null | undefined
  llmsEnabled?: boolean | null | undefined
  markdownEnabled?: boolean | null | undefined
  sitemapEnabled?: boolean | null | undefined
}

export type WhenEnum = 'THIS_MONTH' | 'THIS_WEEK' | 'THIS_YEAR' | 'TODAY'

export type SetCommunityTagMutationVariables = Exact<{
  article: ArticlePathInput
  tagId: string | number
}>

export type SetCommunityTagMutation = {
  setCommunityTag:
    | { innerId: string | null; title: string | null }
    | { innerId: string | null; title: string | null }
    | { innerId: string | null; title: string | null }
    | { innerId: string | null; title: string | null }
    | null
}

export type UnsetCommunityTagMutationVariables = Exact<{
  article: ArticlePathInput
  tagId: string | number
}>

export type UnsetCommunityTagMutation = {
  unsetCommunityTag:
    | { innerId: string | null; title: string | null }
    | { innerId: string | null; title: string | null }
    | { innerId: string | null; title: string | null }
    | { innerId: string | null; title: string | null }
    | null
}

export type FollowMutationVariables = Exact<{
  login: string
}>

export type FollowMutation = {
  follow: { login: string | null; viewerHasFollowed: boolean | null } | null
}

export type UndoFollowMutationVariables = Exact<{
  login: string
}>

export type UndoFollowMutation = {
  undoFollow: { login: string | null; viewerHasFollowed: boolean | null } | null
}

export type PageAuthorFieldsFragment = {
  login: string | null
  nickname: string | null
  avatar: string | null
  bio: string | null
  shortbio: string | null
}

export type PageCommonUserFieldsFragment = {
  login: string | null
  nickname: string | null
  avatar: string | null
  bio: string | null
  shortbio: string | null
}

export type PageCommunityFieldsFragment = {
  title: string | null
  slug: string | null
  index: number | null
  desc: string | null
  logo: string | null
  subscribersCount: number | null
  homepage: string | null
  articlesCount: number | null
  views: number | null
  pending: number | null
  insertedAt: unknown
  updatedAt: unknown
}

export type PageTagFieldsFragment = {
  id: string | null
  title: string | null
  layout: string | null
  desc: string | null
  slug: string | null
  color: RainbowColor | null
  thread: Thread | null
  group: string | null
  groupId: string | null
  index: number | null
  marker: {
    type: MarkerType
    provider: string | null
    name: string | null
    src: string | null
    unified: string | null
  } | null
  community: { slug: string | null } | null
}

export type PagePostFieldsFragment = {
  innerId: string | null
  isPinned: boolean | null
  title: string | null
  insertedAt: unknown
  activeAt: unknown
  updatedAt: unknown
  views: number | null
  commentsCount: number | null
  upvotesCount: number | null
  commentsParticipantsCount: number | null
  author: {
    login: string | null
    nickname: string | null
    avatar: string | null
    bio: string | null
    shortbio: string | null
  } | null
  community: {
    title: string | null
    slug: string | null
    index: number | null
    desc: string | null
    logo: string | null
    subscribersCount: number | null
    homepage: string | null
    articlesCount: number | null
    views: number | null
    pending: number | null
    insertedAt: unknown
    updatedAt: unknown
  } | null
  communities: Array<{
    title: string | null
    slug: string | null
    index: number | null
    desc: string | null
    logo: string | null
    subscribersCount: number | null
    homepage: string | null
    articlesCount: number | null
    views: number | null
    pending: number | null
    insertedAt: unknown
    updatedAt: unknown
  } | null> | null
  communityTags: Array<{
    id: string | null
    title: string | null
    layout: string | null
    desc: string | null
    slug: string | null
    color: RainbowColor | null
    thread: Thread | null
    group: string | null
    groupId: string | null
    index: number | null
    marker: {
      type: MarkerType
      provider: string | null
      name: string | null
      src: string | null
      unified: string | null
    } | null
    community: { slug: string | null } | null
  } | null> | null
}

export type PagePostDetailFieldsFragment = {
  collectsCount: number | null
  archivedAt: unknown
  isArchived: boolean | null
  viewerHasCollected?: boolean | null
  viewerHasUpvoted?: boolean | null
  meta: {
    thread: Thread | null
    isEdited: boolean | null
    latestUpvotedUsers: Array<{
      login: string | null
      nickname: string | null
      avatar: string | null
      bio: string | null
      shortbio: string | null
    } | null> | null
  } | null
  document: {
    json: string | null
    html: string | null
    markdown: string | null
    markdownToc: unknown
  } | null
  commentsParticipants: Array<{
    login: string | null
    nickname: string | null
    avatar: string | null
    bio: string | null
    shortbio: string | null
  } | null> | null
}

export type PageChangelogFieldsFragment = {
  innerId: string | null
  isPinned: boolean | null
  title: string | null
  insertedAt: unknown
  activeAt: unknown
  updatedAt: unknown
  views: number | null
  commentsCount: number | null
  upvotesCount: number | null
  commentsParticipantsCount: number | null
  author: {
    login: string | null
    nickname: string | null
    avatar: string | null
    bio: string | null
    shortbio: string | null
  } | null
  community: {
    title: string | null
    slug: string | null
    index: number | null
    desc: string | null
    logo: string | null
    subscribersCount: number | null
    homepage: string | null
    articlesCount: number | null
    views: number | null
    pending: number | null
    insertedAt: unknown
    updatedAt: unknown
  } | null
  communities: Array<{
    title: string | null
    slug: string | null
    index: number | null
    desc: string | null
    logo: string | null
    subscribersCount: number | null
    homepage: string | null
    articlesCount: number | null
    views: number | null
    pending: number | null
    insertedAt: unknown
    updatedAt: unknown
  } | null> | null
  communityTags: Array<{
    id: string | null
    title: string | null
    layout: string | null
    desc: string | null
    slug: string | null
    color: RainbowColor | null
    thread: Thread | null
    group: string | null
    groupId: string | null
    index: number | null
    marker: {
      type: MarkerType
      provider: string | null
      name: string | null
      src: string | null
      unified: string | null
    } | null
    community: { slug: string | null } | null
  } | null> | null
}

export type PageChangelogDetailFieldsFragment = {
  collectsCount: number | null
  archivedAt: unknown
  isArchived: boolean | null
  viewerHasCollected?: boolean | null
  viewerHasUpvoted?: boolean | null
  meta: {
    thread: Thread | null
    isEdited: boolean | null
    latestUpvotedUsers: Array<{
      login: string | null
      nickname: string | null
      avatar: string | null
      bio: string | null
      shortbio: string | null
    } | null> | null
  } | null
  document: {
    json: string | null
    html: string | null
    markdown: string | null
    markdownToc: unknown
  } | null
  commentsParticipants: Array<{
    login: string | null
    nickname: string | null
    avatar: string | null
    bio: string | null
    shortbio: string | null
  } | null> | null
}

export type PagePostPageInfoFragment = {
  totalPages: number | null
  totalCount: number | null
  pageSize: number | null
  pageNumber: number | null
}

export type PageChangelogPageInfoFragment = {
  totalPages: number | null
  totalCount: number | null
  pageSize: number | null
  pageNumber: number | null
}

export type PageDocFieldsFragment = {
  innerId: string | null
  isPinned: boolean | null
  title: string | null
  insertedAt: unknown
  activeAt: unknown
  updatedAt: unknown
  views: number | null
  commentsCount: number | null
  upvotesCount: number | null
  commentsParticipantsCount: number | null
  author: {
    login: string | null
    nickname: string | null
    avatar: string | null
    bio: string | null
    shortbio: string | null
  } | null
  community: {
    title: string | null
    slug: string | null
    index: number | null
    desc: string | null
    logo: string | null
    subscribersCount: number | null
    homepage: string | null
    articlesCount: number | null
    views: number | null
    pending: number | null
    insertedAt: unknown
    updatedAt: unknown
  } | null
  communities: Array<{
    title: string | null
    slug: string | null
    index: number | null
    desc: string | null
    logo: string | null
    subscribersCount: number | null
    homepage: string | null
    articlesCount: number | null
    views: number | null
    pending: number | null
    insertedAt: unknown
    updatedAt: unknown
  } | null> | null
  communityTags: Array<{
    id: string | null
    title: string | null
    layout: string | null
    desc: string | null
    slug: string | null
    color: RainbowColor | null
    thread: Thread | null
    group: string | null
    groupId: string | null
    index: number | null
    marker: {
      type: MarkerType
      provider: string | null
      name: string | null
      src: string | null
      unified: string | null
    } | null
    community: { slug: string | null } | null
  } | null> | null
}

export type PageDocDetailFieldsFragment = {
  collectsCount: number | null
  archivedAt: unknown
  isArchived: boolean | null
  viewerHasCollected?: boolean | null
  viewerHasUpvoted?: boolean | null
  meta: {
    thread: Thread | null
    isEdited: boolean | null
    latestUpvotedUsers: Array<{
      login: string | null
      nickname: string | null
      avatar: string | null
      bio: string | null
      shortbio: string | null
    } | null> | null
  } | null
  document: {
    json: string | null
    html: string | null
    markdown: string | null
    markdownToc: unknown
  } | null
  commentsParticipants: Array<{
    login: string | null
    nickname: string | null
    avatar: string | null
    bio: string | null
    shortbio: string | null
  } | null> | null
}

export type PageDocPageInfoFragment = {
  totalPages: number | null
  totalCount: number | null
  pageSize: number | null
  pageNumber: number | null
}

export type PageCommunityPageInfoFragment = {
  totalPages: number | null
  totalCount: number | null
  pageSize: number | null
  pageNumber: number | null
}

export type ChangelogQueryVariables = Exact<{
  article: ArticlePathInput
  userHasLogin: boolean
}>

export type ChangelogQuery = {
  changelog: {
    innerId: string | null
    isPinned: boolean | null
    title: string | null
    insertedAt: unknown
    activeAt: unknown
    updatedAt: unknown
    views: number | null
    commentsCount: number | null
    upvotesCount: number | null
    commentsParticipantsCount: number | null
    collectsCount: number | null
    archivedAt: unknown
    isArchived: boolean | null
    viewerHasCollected?: boolean | null
    viewerHasUpvoted?: boolean | null
    author: {
      login: string | null
      nickname: string | null
      avatar: string | null
      bio: string | null
      shortbio: string | null
    } | null
    community: {
      title: string | null
      slug: string | null
      index: number | null
      desc: string | null
      logo: string | null
      subscribersCount: number | null
      homepage: string | null
      articlesCount: number | null
      views: number | null
      pending: number | null
      insertedAt: unknown
      updatedAt: unknown
    } | null
    communities: Array<{
      title: string | null
      slug: string | null
      index: number | null
      desc: string | null
      logo: string | null
      subscribersCount: number | null
      homepage: string | null
      articlesCount: number | null
      views: number | null
      pending: number | null
      insertedAt: unknown
      updatedAt: unknown
    } | null> | null
    communityTags: Array<{
      id: string | null
      title: string | null
      layout: string | null
      desc: string | null
      slug: string | null
      color: RainbowColor | null
      thread: Thread | null
      group: string | null
      groupId: string | null
      index: number | null
      marker: {
        type: MarkerType
        provider: string | null
        name: string | null
        src: string | null
        unified: string | null
      } | null
      community: { slug: string | null } | null
    } | null> | null
    meta: {
      thread: Thread | null
      isEdited: boolean | null
      latestUpvotedUsers: Array<{
        login: string | null
        nickname: string | null
        avatar: string | null
        bio: string | null
        shortbio: string | null
      } | null> | null
    } | null
    document: {
      json: string | null
      html: string | null
      markdown: string | null
      markdownToc: unknown
    } | null
    commentsParticipants: Array<{
      login: string | null
      nickname: string | null
      avatar: string | null
      bio: string | null
      shortbio: string | null
    } | null> | null
  }
}

export type PagedChangelogsQueryVariables = Exact<{
  filter: PagedChangelogsFilter
  userHasLogin: boolean
}>

export type PagedChangelogsQuery = {
  pagedChangelogs: {
    totalPages: number | null
    totalCount: number | null
    pageSize: number | null
    pageNumber: number | null
    entries: Array<{
      digest: string | null
      linkAddr: string | null
      viewerHasViewed?: boolean | null
      viewerHasUpvoted?: boolean | null
      innerId: string | null
      isPinned: boolean | null
      title: string | null
      insertedAt: unknown
      activeAt: unknown
      updatedAt: unknown
      views: number | null
      commentsCount: number | null
      upvotesCount: number | null
      commentsParticipantsCount: number | null
      meta: {
        thread: Thread | null
        latestUpvotedUsers: Array<{
          login: string | null
          nickname: string | null
          avatar: string | null
          bio: string | null
          shortbio: string | null
        } | null> | null
      } | null
      commentsParticipants: Array<{
        login: string | null
        nickname: string | null
        avatar: string | null
        bio: string | null
        shortbio: string | null
      } | null> | null
      author: {
        login: string | null
        nickname: string | null
        avatar: string | null
        bio: string | null
        shortbio: string | null
      } | null
      community: {
        title: string | null
        slug: string | null
        index: number | null
        desc: string | null
        logo: string | null
        subscribersCount: number | null
        homepage: string | null
        articlesCount: number | null
        views: number | null
        pending: number | null
        insertedAt: unknown
        updatedAt: unknown
      } | null
      communities: Array<{
        title: string | null
        slug: string | null
        index: number | null
        desc: string | null
        logo: string | null
        subscribersCount: number | null
        homepage: string | null
        articlesCount: number | null
        views: number | null
        pending: number | null
        insertedAt: unknown
        updatedAt: unknown
      } | null> | null
      communityTags: Array<{
        id: string | null
        title: string | null
        layout: string | null
        desc: string | null
        slug: string | null
        color: RainbowColor | null
        thread: Thread | null
        group: string | null
        groupId: string | null
        index: number | null
        marker: {
          type: MarkerType
          provider: string | null
          name: string | null
          src: string | null
          unified: string | null
        } | null
        community: { slug: string | null } | null
      } | null> | null
    } | null> | null
  } | null
}

export type PageSubscribedCommunitiesQueryVariables = Exact<{
  login?: string | null | undefined
  filter: PagiFilter
}>

export type PageSubscribedCommunitiesQuery = {
  subscribedCommunities: {
    totalPages: number | null
    totalCount: number | null
    pageSize: number | null
    pageNumber: number | null
    entries: Array<{
      contributesDigest: Array<number | null> | null
      title: string | null
      slug: string | null
      index: number | null
      desc: string | null
      logo: string | null
      subscribersCount: number | null
      homepage: string | null
      articlesCount: number | null
      views: number | null
      pending: number | null
      insertedAt: unknown
      updatedAt: unknown
    } | null> | null
  } | null
}

export type PageCommunityQueryVariables = Exact<{
  slug: string
  userHasLogin: boolean
  incViews?: boolean | null | undefined
}>

export type PageCommunityQuery = {
  community: {
    title: string | null
    slug: string | null
    index: number | null
    desc: string | null
    logo: string | null
    subscribersCount: number | null
    homepage: string | null
    articlesCount: number | null
    views: number | null
    pending: number | null
    insertedAt: unknown
    updatedAt: unknown
    viewerHasSubscribed?: boolean | null
    contributesDigest: Array<number | null> | null
    moderatorsCount: number | null
    meta: { postsCount: number | null; blogsCount: number | null } | null
    moderators: Array<{
      isRoot: boolean | null
      passportItemCount: number | null
      user: {
        login: string | null
        avatar: string | null
        nickname: string | null
        bio: string | null
      } | null
    } | null> | null
    dashboard: {
      umamiWebsiteId: string | null
      baseInfo: {
        title: string | null
        slug: string | null
        locale: string | null
        favicon: string | null
        homepage: string | null
        logo: string | null
        desc: string | null
        city: string | null
        techstack: string | null
        introduction: string | null
      } | null
      mediaReports: Array<{
        url: string | null
        title: string | null
        siteName: string | null
        favicon: string | null
        index: number | null
      } | null> | null
      thirdPartyAnalytics: Array<{
        provider: string | null
        enabled: boolean | null
        measurementId: string | null
        containerId: string | null
        projectId: string | null
        domain: string | null
        siteId: string | null
      } | null> | null
      enabledThirdPartyAnalytics: Array<{
        provider: string | null
        enabled: boolean | null
        measurementId: string | null
        containerId: string | null
        projectId: string | null
        domain: string | null
        siteId: string | null
      } | null> | null
      docFaq: {
        title: string | null
        desc: string | null
        groupedView: boolean | null
        groupItems: Array<{
          id: string | null
          title: string | null
          index: number | null
          items: Array<{
            id: string | null
            title: string | null
            detail: string | null
            index: number | null
          } | null> | null
        } | null> | null
        flatItems: Array<{
          id: string | null
          title: string | null
          detail: string | null
          index: number | null
        } | null> | null
      } | null
      wallpaper: {
        light: {
          type: string | null
          source: string | null
          gradient: unknown
          pattern: unknown
          contentShadow: unknown
          effect: unknown
          texture: unknown
        } | null
        dark: {
          type: string | null
          source: string | null
          gradient: unknown
          pattern: unknown
          contentShadow: unknown
          effect: unknown
          texture: unknown
        } | null
      } | null
      headerLinks: Array<{
        id: string | null
        type: DsbLinkType | null
        title: string | null
        url: string | null
        links: Array<{ id: string | null; title: string | null; url: string | null } | null> | null
      } | null> | null
      footerLinks: Array<{
        id: string | null
        type: DsbLinkType | null
        title: string | null
        url: string | null
        links: Array<{ id: string | null; title: string | null; url: string | null } | null> | null
      } | null> | null
      footerOnelineLinks: Array<{
        id: string | null
        title: string | null
        url: string | null
      } | null> | null
      socialLinks: Array<{ type: string | null; link: string | null } | null> | null
      seo: {
        seoEnable: boolean | null
        ogSiteName: string | null
        ogTitle: string | null
        ogDescription: string | null
        ogUrl: string | null
        ogImage: string | null
        twTitle: string | null
        twDescription: string | null
        twUrl: string | null
        twCard: string | null
        twSite: string | null
        twImage: string | null
        twImageWidth: string | null
        twImageHeight: string | null
      } | null
      nameAlias: Array<{
        slug: string | null
        name: string | null
        original: string | null
        group: string | null
      } | null> | null
      layout: {
        themePreset: DsbThemePreset | null
        themePresetBase: DsbThemePreset | null
        themeTokens: unknown
        postLayout: DsbPostLayout | null
        docCoverLayout: DsbDocCoverLayout | null
        docFaqLayout: DsbDocFaqLayout | null
        tagLayout: DsbTagLayout | null
        inlineTagLayout: DsbInlineTagLayout | null
        avatarLayout: DsbAvatarLayout | null
        brandLayout: DsbBrandLayout | null
        communityLayout: DsbCommunityLayout | null
        navActiveLayout: DsbNavActiveLayout | null
        topbarEnabled: boolean | null
        topbarBg: RainbowColor | null
        topbarBgCustomColor: string | null
        broadcastLayout: DsbBroadcastLayout | null
        broadcastBg: RainbowColor | null
        broadcastCustomBg: string | null
        broadcastArticleBg: RainbowColor | null
        broadcastArticleCustomBg: string | null
        kanbanLayout: DsbKanbanLayout | null
        kanbanCardLayout: DsbKanbanCardLayout | null
        kanbanBoards: Array<KanbanBoard | null> | null
        kanbanBgColors: Array<RainbowColor | null> | null
        changelogLayout: DsbChangelogLayout | null
        headerLayout: DsbHeaderLayout | null
        footerLayout: DsbFooterLayout | null
        overlayDark: boolean | null
        broadcastEnable: boolean | null
        themePresets: Array<{ value: DsbThemePreset; tokens: unknown } | null> | null
      } | null
      enable: {
        post: boolean | null
        kanban: boolean | null
        changelog: boolean | null
        doc: boolean | null
        about: boolean | null
      } | null
    } | null
  } | null
}

export type PagePagedCommunitiesQueryVariables = Exact<{
  filter: CommunitiesFilter
  userHasLogin: boolean
}>

export type PagePagedCommunitiesQuery = {
  pagedCommunities: {
    totalPages: number | null
    totalCount: number | null
    pageSize: number | null
    pageNumber: number | null
    entries: Array<{
      contributesDigest: Array<number | null> | null
      viewerHasSubscribed?: boolean | null
      title: string | null
      slug: string | null
      index: number | null
      desc: string | null
      logo: string | null
      subscribersCount: number | null
      homepage: string | null
      articlesCount: number | null
      views: number | null
      pending: number | null
      insertedAt: unknown
      updatedAt: unknown
    } | null> | null
  } | null
}

export type PageDocPublicTreeNodeFieldsFragment = {
  id: string | null
  parentNodeId: string | null
  docId: string | null
  type: DocTreeNodeType | null
  title: string | null
  index: number | null
  href: string | null
  badge: string | null
  marker: {
    type: MarkerType
    provider: string | null
    name: string | null
    src: string | null
    unified: string | null
    appearance: {
      light: { color: string | null; bg: string | null }
      dark: { color: string | null; bg: string | null }
    } | null
  } | null
}

export type PageDocPublicTreeChildFieldsFragment = {
  id: string | null
  parentNodeId: string | null
  docId: string | null
  type: DocTreeNodeType | null
  title: string | null
  index: number | null
  href: string | null
  badge: string | null
  pages: Array<{
    id: string | null
    parentNodeId: string | null
    docId: string | null
    type: DocTreeNodeType | null
    title: string | null
    index: number | null
    href: string | null
    badge: string | null
    marker: {
      type: MarkerType
      provider: string | null
      name: string | null
      src: string | null
      unified: string | null
      appearance: {
        light: { color: string | null; bg: string | null }
        dark: { color: string | null; bg: string | null }
      } | null
    } | null
  } | null> | null
  marker: {
    type: MarkerType
    provider: string | null
    name: string | null
    src: string | null
    unified: string | null
    appearance: {
      light: { color: string | null; bg: string | null }
      dark: { color: string | null; bg: string | null }
    } | null
  } | null
}

export type PageDocPublicTreeGroupFieldsFragment = {
  id: string | null
  parentNodeId: string | null
  docId: string | null
  type: DocTreeNodeType | null
  title: string | null
  index: number | null
  href: string | null
  badge: string | null
  pages: Array<{
    id: string | null
    parentNodeId: string | null
    docId: string | null
    type: DocTreeNodeType | null
    title: string | null
    index: number | null
    href: string | null
    badge: string | null
    pages: Array<{
      id: string | null
      parentNodeId: string | null
      docId: string | null
      type: DocTreeNodeType | null
      title: string | null
      index: number | null
      href: string | null
      badge: string | null
      marker: {
        type: MarkerType
        provider: string | null
        name: string | null
        src: string | null
        unified: string | null
        appearance: {
          light: { color: string | null; bg: string | null }
          dark: { color: string | null; bg: string | null }
        } | null
      } | null
    } | null> | null
    marker: {
      type: MarkerType
      provider: string | null
      name: string | null
      src: string | null
      unified: string | null
      appearance: {
        light: { color: string | null; bg: string | null }
        dark: { color: string | null; bg: string | null }
      } | null
    } | null
  } | null> | null
  marker: {
    type: MarkerType
    provider: string | null
    name: string | null
    src: string | null
    unified: string | null
    appearance: {
      light: { color: string | null; bg: string | null }
      dark: { color: string | null; bg: string | null }
    } | null
  } | null
}

export type PageDocQueryVariables = Exact<{
  article: ArticlePathInput
  userHasLogin: boolean
}>

export type PageDocQuery = {
  doc: {
    subtitle: string | null
    innerId: string | null
    isPinned: boolean | null
    title: string | null
    insertedAt: unknown
    activeAt: unknown
    updatedAt: unknown
    views: number | null
    commentsCount: number | null
    upvotesCount: number | null
    commentsParticipantsCount: number | null
    collectsCount: number | null
    archivedAt: unknown
    isArchived: boolean | null
    viewerHasCollected?: boolean | null
    viewerHasUpvoted?: boolean | null
    author: {
      login: string | null
      nickname: string | null
      avatar: string | null
      bio: string | null
      shortbio: string | null
    } | null
    community: {
      title: string | null
      slug: string | null
      index: number | null
      desc: string | null
      logo: string | null
      subscribersCount: number | null
      homepage: string | null
      articlesCount: number | null
      views: number | null
      pending: number | null
      insertedAt: unknown
      updatedAt: unknown
    } | null
    communities: Array<{
      title: string | null
      slug: string | null
      index: number | null
      desc: string | null
      logo: string | null
      subscribersCount: number | null
      homepage: string | null
      articlesCount: number | null
      views: number | null
      pending: number | null
      insertedAt: unknown
      updatedAt: unknown
    } | null> | null
    communityTags: Array<{
      id: string | null
      title: string | null
      layout: string | null
      desc: string | null
      slug: string | null
      color: RainbowColor | null
      thread: Thread | null
      group: string | null
      groupId: string | null
      index: number | null
      marker: {
        type: MarkerType
        provider: string | null
        name: string | null
        src: string | null
        unified: string | null
      } | null
      community: { slug: string | null } | null
    } | null> | null
    meta: {
      thread: Thread | null
      isEdited: boolean | null
      latestUpvotedUsers: Array<{
        login: string | null
        nickname: string | null
        avatar: string | null
        bio: string | null
        shortbio: string | null
      } | null> | null
    } | null
    document: {
      json: string | null
      html: string | null
      markdown: string | null
      markdownToc: unknown
    } | null
    commentsParticipants: Array<{
      login: string | null
      nickname: string | null
      avatar: string | null
      bio: string | null
      shortbio: string | null
    } | null> | null
  }
}

export type PageDocPublicTreeQueryVariables = Exact<{
  community: string
}>

export type PageDocPublicTreeQuery = {
  docPublicTree: {
    tabs: Array<{
      id: string | null
      parentNodeId: string | null
      docId: string | null
      type: DocTreeNodeType | null
      title: string | null
      index: number | null
      href: string | null
      badge: string | null
      pins: Array<{
        id: string | null
        parentNodeId: string | null
        docId: string | null
        type: DocTreeNodeType | null
        title: string | null
        index: number | null
        href: string | null
        badge: string | null
        marker: {
          type: MarkerType
          provider: string | null
          name: string | null
          src: string | null
          unified: string | null
          appearance: {
            light: { color: string | null; bg: string | null }
            dark: { color: string | null; bg: string | null }
          } | null
        } | null
      } | null> | null
      groups: Array<{
        id: string | null
        parentNodeId: string | null
        docId: string | null
        type: DocTreeNodeType | null
        title: string | null
        index: number | null
        href: string | null
        badge: string | null
        pages: Array<{
          id: string | null
          parentNodeId: string | null
          docId: string | null
          type: DocTreeNodeType | null
          title: string | null
          index: number | null
          href: string | null
          badge: string | null
          pages: Array<{
            id: string | null
            parentNodeId: string | null
            docId: string | null
            type: DocTreeNodeType | null
            title: string | null
            index: number | null
            href: string | null
            badge: string | null
            marker: {
              type: MarkerType
              provider: string | null
              name: string | null
              src: string | null
              unified: string | null
              appearance: {
                light: { color: string | null; bg: string | null }
                dark: { color: string | null; bg: string | null }
              } | null
            } | null
          } | null> | null
          marker: {
            type: MarkerType
            provider: string | null
            name: string | null
            src: string | null
            unified: string | null
            appearance: {
              light: { color: string | null; bg: string | null }
              dark: { color: string | null; bg: string | null }
            } | null
          } | null
        } | null> | null
        marker: {
          type: MarkerType
          provider: string | null
          name: string | null
          src: string | null
          unified: string | null
          appearance: {
            light: { color: string | null; bg: string | null }
            dark: { color: string | null; bg: string | null }
          } | null
        } | null
      } | null> | null
      marker: {
        type: MarkerType
        provider: string | null
        name: string | null
        src: string | null
        unified: string | null
        appearance: {
          light: { color: string | null; bg: string | null }
          dark: { color: string | null; bg: string | null }
        } | null
      } | null
    } | null> | null
  } | null
}

export type PagePagedDocsQueryVariables = Exact<{
  filter: PagedDocsFilter
  userHasLogin: boolean
}>

export type PagePagedDocsQuery = {
  pagedDocs: {
    totalPages: number | null
    totalCount: number | null
    pageSize: number | null
    pageNumber: number | null
    entries: Array<{
      viewerHasViewed?: boolean | null
      viewerHasUpvoted?: boolean | null
      innerId: string | null
      isPinned: boolean | null
      title: string | null
      insertedAt: unknown
      activeAt: unknown
      updatedAt: unknown
      views: number | null
      commentsCount: number | null
      upvotesCount: number | null
      commentsParticipantsCount: number | null
      meta: {
        thread: Thread | null
        latestUpvotedUsers: Array<{
          login: string | null
          nickname: string | null
          avatar: string | null
          bio: string | null
          shortbio: string | null
        } | null> | null
      } | null
      commentsParticipants: Array<{
        login: string | null
        nickname: string | null
        avatar: string | null
        bio: string | null
        shortbio: string | null
      } | null> | null
      author: {
        login: string | null
        nickname: string | null
        avatar: string | null
        bio: string | null
        shortbio: string | null
      } | null
      community: {
        title: string | null
        slug: string | null
        index: number | null
        desc: string | null
        logo: string | null
        subscribersCount: number | null
        homepage: string | null
        articlesCount: number | null
        views: number | null
        pending: number | null
        insertedAt: unknown
        updatedAt: unknown
      } | null
      communities: Array<{
        title: string | null
        slug: string | null
        index: number | null
        desc: string | null
        logo: string | null
        subscribersCount: number | null
        homepage: string | null
        articlesCount: number | null
        views: number | null
        pending: number | null
        insertedAt: unknown
        updatedAt: unknown
      } | null> | null
      communityTags: Array<{
        id: string | null
        title: string | null
        layout: string | null
        desc: string | null
        slug: string | null
        color: RainbowColor | null
        thread: Thread | null
        group: string | null
        groupId: string | null
        index: number | null
        marker: {
          type: MarkerType
          provider: string | null
          name: string | null
          src: string | null
          unified: string | null
        } | null
        community: { slug: string | null } | null
      } | null> | null
    } | null> | null
  } | null
}

export type PageCategoryPageInfoFragment = {
  totalPages: number | null
  totalCount: number | null
  pageSize: number | null
  pageNumber: number | null
}

export type PageCommunityTagGroupsQueryVariables = Exact<{
  community: string
  thread?: Thread | null | undefined
}>

export type PageCommunityTagGroupsQuery = {
  communityTagGroups: Array<{
    id: string | null
    title: string | null
    index: number | null
    tags: Array<{
      id: string | null
      title: string | null
      layout: string | null
      desc: string | null
      slug: string | null
      color: RainbowColor | null
      thread: Thread | null
      group: string | null
      groupId: string | null
      index: number | null
      marker: {
        type: MarkerType
        provider: string | null
        name: string | null
        src: string | null
        unified: string | null
      } | null
      community: { slug: string | null } | null
    } | null> | null
  } | null> | null
}

export type CommunityTagStatsQueryVariables = Exact<{
  community: string
  thread: Thread
  slug: string
}>

export type CommunityTagStatsQuery = {
  communityTagStats: { contentsCount: number | null; todayContentsCount: number | null } | null
}

export type ThemePresetsQueryVariables = Exact<{ [key: string]: never }>

export type ThemePresetsQuery = { themePresets: Array<{ value: DsbThemePreset; tokens: unknown }> }

export type PagePagedCategoriesQueryVariables = Exact<{
  filter: PagiFilter
}>

export type PagePagedCategoriesQuery = {
  pagedCategories: {
    totalPages: number | null
    totalCount: number | null
    pageSize: number | null
    pageNumber: number | null
    entries: Array<{
      id: string | null
      title: string | null
      slug: string | null
      index: number | null
    } | null> | null
  } | null
}

export type PostQueryVariables = Exact<{
  article: ArticlePathInput
  userHasLogin: boolean
}>

export type PostQuery = {
  post: {
    innerId: string | null
    isPinned: boolean | null
    title: string | null
    insertedAt: unknown
    activeAt: unknown
    updatedAt: unknown
    views: number | null
    commentsCount: number | null
    upvotesCount: number | null
    commentsParticipantsCount: number | null
    collectsCount: number | null
    archivedAt: unknown
    isArchived: boolean | null
    viewerHasCollected?: boolean | null
    viewerHasUpvoted?: boolean | null
    author: {
      login: string | null
      nickname: string | null
      avatar: string | null
      bio: string | null
      shortbio: string | null
    } | null
    community: {
      title: string | null
      slug: string | null
      index: number | null
      desc: string | null
      logo: string | null
      subscribersCount: number | null
      homepage: string | null
      articlesCount: number | null
      views: number | null
      pending: number | null
      insertedAt: unknown
      updatedAt: unknown
    } | null
    communities: Array<{
      title: string | null
      slug: string | null
      index: number | null
      desc: string | null
      logo: string | null
      subscribersCount: number | null
      homepage: string | null
      articlesCount: number | null
      views: number | null
      pending: number | null
      insertedAt: unknown
      updatedAt: unknown
    } | null> | null
    communityTags: Array<{
      id: string | null
      title: string | null
      layout: string | null
      desc: string | null
      slug: string | null
      color: RainbowColor | null
      thread: Thread | null
      group: string | null
      groupId: string | null
      index: number | null
      marker: {
        type: MarkerType
        provider: string | null
        name: string | null
        src: string | null
        unified: string | null
      } | null
      community: { slug: string | null } | null
    } | null> | null
    meta: {
      thread: Thread | null
      isEdited: boolean | null
      latestUpvotedUsers: Array<{
        login: string | null
        nickname: string | null
        avatar: string | null
        bio: string | null
        shortbio: string | null
      } | null> | null
    } | null
    document: {
      json: string | null
      html: string | null
      markdown: string | null
      markdownToc: unknown
    } | null
    commentsParticipants: Array<{
      login: string | null
      nickname: string | null
      avatar: string | null
      bio: string | null
      shortbio: string | null
    } | null> | null
  }
}

export type PagedPostsQueryVariables = Exact<{
  filter: PagedPostsFilter
  userHasLogin: boolean
}>

export type PagedPostsQuery = {
  pagedPosts: {
    totalPages: number | null
    totalCount: number | null
    pageSize: number | null
    pageNumber: number | null
    entries: Array<{
      cat: ArticleCatEnum | null
      status: ArticleStatusEnum | null
      digest: string | null
      viewerHasViewed?: boolean | null
      viewerHasUpvoted?: boolean | null
      innerId: string | null
      isPinned: boolean | null
      title: string | null
      insertedAt: unknown
      activeAt: unknown
      updatedAt: unknown
      views: number | null
      commentsCount: number | null
      upvotesCount: number | null
      commentsParticipantsCount: number | null
      meta: {
        thread: Thread | null
        latestUpvotedUsers: Array<{
          login: string | null
          nickname: string | null
          avatar: string | null
          bio: string | null
          shortbio: string | null
        } | null> | null
      } | null
      commentsParticipants: Array<{
        login: string | null
        nickname: string | null
        avatar: string | null
        bio: string | null
        shortbio: string | null
      } | null> | null
      author: {
        login: string | null
        nickname: string | null
        avatar: string | null
        bio: string | null
        shortbio: string | null
      } | null
      community: {
        title: string | null
        slug: string | null
        index: number | null
        desc: string | null
        logo: string | null
        subscribersCount: number | null
        homepage: string | null
        articlesCount: number | null
        views: number | null
        pending: number | null
        insertedAt: unknown
        updatedAt: unknown
      } | null
      communities: Array<{
        title: string | null
        slug: string | null
        index: number | null
        desc: string | null
        logo: string | null
        subscribersCount: number | null
        homepage: string | null
        articlesCount: number | null
        views: number | null
        pending: number | null
        insertedAt: unknown
        updatedAt: unknown
      } | null> | null
      communityTags: Array<{
        id: string | null
        title: string | null
        layout: string | null
        desc: string | null
        slug: string | null
        color: RainbowColor | null
        thread: Thread | null
        group: string | null
        groupId: string | null
        index: number | null
        marker: {
          type: MarkerType
          provider: string | null
          name: string | null
          src: string | null
          unified: string | null
        } | null
        community: { slug: string | null } | null
      } | null> | null
    } | null> | null
  } | null
}

export type PagedPublishedPostsQueryVariables = Exact<{
  login: string
  filter: PagiFilter
  userHasLogin: boolean
}>

export type PagedPublishedPostsQuery = {
  pagedPublishedPosts: {
    totalPages: number | null
    totalCount: number | null
    pageSize: number | null
    pageNumber: number | null
    entries: Array<{
      digest: string | null
      linkAddr: string | null
      viewerHasViewed?: boolean | null
      viewerHasUpvoted?: boolean | null
      innerId: string | null
      isPinned: boolean | null
      title: string | null
      insertedAt: unknown
      activeAt: unknown
      updatedAt: unknown
      views: number | null
      commentsCount: number | null
      upvotesCount: number | null
      commentsParticipantsCount: number | null
      meta: { thread: Thread | null } | null
      commentsParticipants: Array<{
        login: string | null
        nickname: string | null
        avatar: string | null
        bio: string | null
        shortbio: string | null
      } | null> | null
      author: {
        login: string | null
        nickname: string | null
        avatar: string | null
        bio: string | null
        shortbio: string | null
      } | null
      community: {
        title: string | null
        slug: string | null
        index: number | null
        desc: string | null
        logo: string | null
        subscribersCount: number | null
        homepage: string | null
        articlesCount: number | null
        views: number | null
        pending: number | null
        insertedAt: unknown
        updatedAt: unknown
      } | null
      communities: Array<{
        title: string | null
        slug: string | null
        index: number | null
        desc: string | null
        logo: string | null
        subscribersCount: number | null
        homepage: string | null
        articlesCount: number | null
        views: number | null
        pending: number | null
        insertedAt: unknown
        updatedAt: unknown
      } | null> | null
      communityTags: Array<{
        id: string | null
        title: string | null
        layout: string | null
        desc: string | null
        slug: string | null
        color: RainbowColor | null
        thread: Thread | null
        group: string | null
        groupId: string | null
        index: number | null
        marker: {
          type: MarkerType
          provider: string | null
          name: string | null
          src: string | null
          unified: string | null
        } | null
        community: { slug: string | null } | null
      } | null> | null
    } | null> | null
  } | null
}

export type PagesGroupedKanbanPostsQueryVariables = Exact<{
  community: string
}>

export type PagesGroupedKanbanPostsQuery = {
  groupedKanbanPosts: {
    backlog: {
      totalPages: number | null
      totalCount: number | null
      pageSize: number | null
      pageNumber: number | null
      entries: Array<{
        innerId: string | null
        cat: ArticleCatEnum | null
        status: ArticleStatusEnum | null
        title: string | null
        community: { slug: string | null } | null
        meta: { thread: Thread | null } | null
        author: {
          login: string | null
          nickname: string | null
          avatar: string | null
          bio: string | null
          shortbio: string | null
        } | null
      } | null> | null
    } | null
    todo: {
      totalPages: number | null
      totalCount: number | null
      pageSize: number | null
      pageNumber: number | null
      entries: Array<{
        innerId: string | null
        cat: ArticleCatEnum | null
        status: ArticleStatusEnum | null
        title: string | null
        community: { slug: string | null } | null
        meta: { thread: Thread | null } | null
        author: {
          login: string | null
          nickname: string | null
          avatar: string | null
          bio: string | null
          shortbio: string | null
        } | null
      } | null> | null
    } | null
    wip: {
      totalPages: number | null
      totalCount: number | null
      pageSize: number | null
      pageNumber: number | null
      entries: Array<{
        innerId: string | null
        cat: ArticleCatEnum | null
        status: ArticleStatusEnum | null
        title: string | null
        community: { slug: string | null } | null
        meta: { thread: Thread | null } | null
        author: {
          login: string | null
          nickname: string | null
          avatar: string | null
          bio: string | null
          shortbio: string | null
        } | null
      } | null> | null
    } | null
    done: {
      totalPages: number | null
      totalCount: number | null
      pageSize: number | null
      pageNumber: number | null
      entries: Array<{
        innerId: string | null
        cat: ArticleCatEnum | null
        status: ArticleStatusEnum | null
        title: string | null
        community: { slug: string | null } | null
        meta: { thread: Thread | null } | null
        author: {
          login: string | null
          nickname: string | null
          avatar: string | null
          bio: string | null
          shortbio: string | null
        } | null
      } | null> | null
    } | null
    rejected: {
      totalPages: number | null
      totalCount: number | null
      pageSize: number | null
      pageNumber: number | null
      entries: Array<{
        innerId: string | null
        cat: ArticleCatEnum | null
        status: ArticleStatusEnum | null
        title: string | null
        community: { slug: string | null } | null
        meta: { thread: Thread | null } | null
        author: {
          login: string | null
          nickname: string | null
          avatar: string | null
          bio: string | null
          shortbio: string | null
        } | null
      } | null> | null
    } | null
  } | null
}

export type UserAuthorFieldsFragment = {
  login: string | null
  nickname: string | null
  avatar: string | null
  bio: string | null
  shortbio: string | null
}

export type UserSocialFieldsFragment = {
  github: string | null
  twitter: string | null
  company: string | null
  blog: string | null
}

export type UserAchievementFieldsFragment = {
  reputation: number | null
  articlesUpvotesCount: number | null
  articlesCollectsCount: number | null
  donateMember: boolean | null
  seniorMember: boolean | null
  sponsorMember: boolean | null
}

export type MeQueryVariables = Exact<{ [key: string]: never }>

export type MeQuery = {
  me: {
    login: string | null
    nickname: string | null
    avatar: string | null
    bio: string | null
    passport: unknown
  } | null
}

export type UserQueryVariables = Exact<{
  login: string
  userHasLogin: boolean
}>

export type UserQuery = {
  user: {
    views: number | null
    sex: string | null
    location: string | null
    followersCount: number | null
    followingsCount: number | null
    viewerHasFollowed?: boolean | null
    subscribedCommunitiesCount: number | null
    insertedAt: unknown
    login: string | null
    nickname: string | null
    avatar: string | null
    bio: string | null
    shortbio: string | null
    social: {
      github: string | null
      twitter: string | null
      company: string | null
      blog: string | null
    } | null
    meta: {
      isMaker: boolean | null
      publishedPostsCount: number | null
      publishedBlogsCount: number | null
    } | null
    achievement: {
      reputation: number | null
      articlesUpvotesCount: number | null
      articlesCollectsCount: number | null
      donateMember: boolean | null
      seniorMember: boolean | null
      sponsorMember: boolean | null
    } | null
    contributes: {
      startDate: unknown
      endDate: unknown
      totalCount: number | null
      records: Array<{ count: number | null; date: unknown } | null> | null
    } | null
  } | null
}

export type SessionStateQueryVariables = Exact<{ [key: string]: never }>

export type SessionStateQuery = {
  sessionState: {
    isValid: boolean | null
    user: {
      geoCity: string | null
      location: string | null
      passport: unknown
      subscribedCommunitiesCount: number | null
      login: string | null
      nickname: string | null
      avatar: string | null
      bio: string | null
      shortbio: string | null
      social: {
        github: string | null
        twitter: string | null
        company: string | null
        blog: string | null
      } | null
      achievement: {
        reputation: number | null
        articlesUpvotesCount: number | null
        articlesCollectsCount: number | null
        donateMember: boolean | null
        seniorMember: boolean | null
        sponsorMember: boolean | null
      } | null
    } | null
  } | null
}

export type AboutSimpleQueryQueryVariables = Exact<{
  article: ArticlePathInput
}>

export type AboutSimpleQueryQuery = { post: { innerId: string | null } }

export type ArticleEditorAuthorFieldsFragment = {
  login: string | null
  nickname: string | null
  avatar: string | null
  bio: string | null
  shortbio: string | null
}

export type ArticleEditorCommunityFieldsFragment = {
  title: string | null
  slug: string | null
  index: number | null
  desc: string | null
  logo: string | null
  subscribersCount: number | null
  homepage: string | null
  articlesCount: number | null
  views: number | null
  pending: number | null
  insertedAt: unknown
  updatedAt: unknown
}

export type ArticleEditorTagFieldsFragment = {
  id: string | null
  title: string | null
  layout: string | null
  desc: string | null
  slug: string | null
  color: RainbowColor | null
  thread: Thread | null
  group: string | null
  groupId: string | null
  index: number | null
  marker: {
    type: MarkerType
    provider: string | null
    name: string | null
    src: string | null
    unified: string | null
  } | null
  community: { slug: string | null } | null
}

export type CreatePostMutationVariables = Exact<{
  title: string
  bodyBag: ArtimentBodyBagInput
  community: string
  communityTags?: Array<string | number | null | undefined> | string | number | null | undefined
  linkAddr?: string | null | undefined
  copyRight?: string | null | undefined
}>

export type CreatePostMutation = {
  createPost: {
    innerId: string | null
    title: string | null
    meta: { thread: Thread | null } | null
  } | null
}

export type UpdatePostFromEditorMutationVariables = Exact<{
  article: ArticlePathInput
  title?: string | null | undefined
  bodyBag?: ArtimentBodyBagInput | null | undefined
  linkAddr?: string | null | undefined
  copyRight?: string | null | undefined
  communityTags?: Array<string | number | null | undefined> | string | number | null | undefined
}>

export type UpdatePostFromEditorMutation = {
  updatePost: {
    innerId: string | null
    title: string | null
    author: {
      login: string | null
      nickname: string | null
      avatar: string | null
      bio: string | null
      shortbio: string | null
    } | null
    meta: {
      thread: Thread | null
      isLegal: boolean | null
      illegalReason: Array<string | null> | null
      illegalWords: Array<string | null> | null
    } | null
  } | null
}

export type ArticleEditorCommunityQueryVariables = Exact<{
  slug: string
}>

export type ArticleEditorCommunityQuery = {
  community: {
    logo: string | null
    title: string | null
    slug: string | null
    desc: string | null
    subscribersCount: number | null
  } | null
}

export type ArticleEditorPostQueryVariables = Exact<{
  article: ArticlePathInput
}>

export type ArticleEditorPostQuery = {
  post: {
    innerId: string | null
    title: string | null
    linkAddr: string | null
    copyRight: string | null
    archivedAt: unknown
    isArchived: boolean | null
    author: {
      login: string | null
      nickname: string | null
      avatar: string | null
      bio: string | null
      shortbio: string | null
    } | null
    community: {
      title: string | null
      slug: string | null
      index: number | null
      desc: string | null
      logo: string | null
      subscribersCount: number | null
      homepage: string | null
      articlesCount: number | null
      views: number | null
      pending: number | null
      insertedAt: unknown
      updatedAt: unknown
    } | null
    communityTags: Array<{
      id: string | null
      title: string | null
      layout: string | null
      desc: string | null
      slug: string | null
      color: RainbowColor | null
      thread: Thread | null
      group: string | null
      groupId: string | null
      index: number | null
      marker: {
        type: MarkerType
        provider: string | null
        name: string | null
        src: string | null
        unified: string | null
      } | null
      community: { slug: string | null } | null
    } | null> | null
    meta: {
      thread: Thread | null
      isLegal: boolean | null
      illegalReason: Array<string | null> | null
      illegalWords: Array<string | null> | null
    } | null
    document: { json: string | null } | null
  }
}

export type ArticleMenuTagFieldsFragment = {
  id: string | null
  title: string | null
  layout: string | null
  desc: string | null
  slug: string | null
  color: RainbowColor | null
  thread: Thread | null
  group: string | null
  groupId: string | null
  index: number | null
  marker: {
    type: MarkerType
    provider: string | null
    name: string | null
    src: string | null
    unified: string | null
  } | null
  community: { slug: string | null } | null
}

export type UpdatePostFromMenuMutationVariables = Exact<{
  article: ArticlePathInput
  title?: string | null | undefined
  communityTags?: Array<string | number | null | undefined> | string | number | null | undefined
}>

export type UpdatePostFromMenuMutation = {
  updatePost: {
    innerId: string | null
    title: string | null
    communityTags: Array<{
      id: string | null
      title: string | null
      layout: string | null
      desc: string | null
      slug: string | null
      color: RainbowColor | null
      thread: Thread | null
      group: string | null
      groupId: string | null
      index: number | null
      marker: {
        type: MarkerType
        provider: string | null
        name: string | null
        src: string | null
        unified: string | null
      } | null
      community: { slug: string | null } | null
    } | null> | null
  } | null
}

export type SetPostCatMutationVariables = Exact<{
  article: ArticlePathInput
  cat: ArticleCatEnum
}>

export type SetPostCatMutation = {
  setPostCat: { innerId: string | null; cat: ArticleCatEnum | null } | null
}

export type SetPostStatusMutationVariables = Exact<{
  article: ArticlePathInput
  status: ArticleStatusEnum
}>

export type SetPostStatusMutation = {
  setPostStatus: { innerId: string | null; status: ArticleStatusEnum | null } | null
}

export type PinPostMutationVariables = Exact<{
  article: ArticlePathInput
}>

export type PinPostMutation = { pinPost: { innerId: string | null } | null }

export type UndoPinPostMutationVariables = Exact<{
  article: ArticlePathInput
}>

export type UndoPinPostMutation = {
  undoPinPost: { innerId: string | null; isPinned: boolean | null } | null
}

export type CommunityTagGroupsForMenuQueryVariables = Exact<{
  community: string
  thread?: Thread | null | undefined
}>

export type CommunityTagGroupsForMenuQuery = {
  communityTagGroups: Array<{
    id: string | null
    title: string | null
    index: number | null
    tags: Array<{
      id: string | null
      title: string | null
      layout: string | null
      desc: string | null
      slug: string | null
      color: RainbowColor | null
      thread: Thread | null
      group: string | null
      groupId: string | null
      index: number | null
      marker: {
        type: MarkerType
        provider: string | null
        name: string | null
        src: string | null
        unified: string | null
      } | null
      community: { slug: string | null } | null
    } | null> | null
  } | null> | null
}

export type ChangelogSimpleQueryQueryVariables = Exact<{
  article: ArticlePathInput
}>

export type ChangelogSimpleQueryQuery = { post: { innerId: string | null } }

export type CommentAuthorFieldsFragment = {
  login: string | null
  nickname: string | null
  avatar: string | null
  bio: string | null
  shortbio: string | null
}

export type CommentEmotionFieldsFragment = {
  type: EmotionType | null
  count: number | null
  viewerHasReacted: boolean | null
  latestUsers: Array<{
    login: string | null
    nickname: string | null
    avatar: string | null
  } | null> | null
}

export type CommentMetaFieldsFragment = {
  isLegal: boolean | null
  illegalReason: Array<string | null> | null
  illegalWords: Array<string | null> | null
  isArticleAuthorUpvoted: boolean | null
  isReplyToOthers: boolean | null
}

export type CommentFieldsFragment = {
  innerId: string | null
  bodyHtml: string | null
  isPinned: boolean | null
  floor: number | null
  upvotesCount: number | null
  isArticleAuthor: boolean | null
  viewerHasUpvoted: boolean | null
  viewerHasReported: boolean | null
  repliesCount: number | null
  insertedAt: unknown
  updatedAt: unknown
  author: {
    login: string | null
    nickname: string | null
    avatar: string | null
    bio: string | null
    shortbio: string | null
  } | null
  meta: {
    isLegal: boolean | null
    illegalReason: Array<string | null> | null
    illegalWords: Array<string | null> | null
    isArticleAuthorUpvoted: boolean | null
    isReplyToOthers: boolean | null
  } | null
  emotions: Array<{
    type: EmotionType | null
    count: number | null
    viewerHasReacted: boolean | null
    latestUsers: Array<{
      login: string | null
      nickname: string | null
      avatar: string | null
    } | null> | null
  } | null> | null
}

export type CommentReplyFieldsFragment = {
  innerId: string | null
  bodyHtml: string | null
  isPinned: boolean | null
  floor: number | null
  upvotesCount: number | null
  isArticleAuthor: boolean | null
  viewerHasUpvoted: boolean | null
  viewerHasReported: boolean | null
  repliesCount: number | null
  insertedAt: unknown
  updatedAt: unknown
  author: {
    login: string | null
    nickname: string | null
    avatar: string | null
    bio: string | null
    shortbio: string | null
  } | null
  meta: {
    isLegal: boolean | null
    illegalReason: Array<string | null> | null
    illegalWords: Array<string | null> | null
    isArticleAuthorUpvoted: boolean | null
    isReplyToOthers: boolean | null
  } | null
  emotions: Array<{
    type: EmotionType | null
    count: number | null
    viewerHasReacted: boolean | null
    latestUsers: Array<{
      login: string | null
      nickname: string | null
      avatar: string | null
    } | null> | null
  } | null> | null
  replyToComment: {
    innerId: string | null
    bodyHtml: string | null
    isPinned: boolean | null
    floor: number | null
    upvotesCount: number | null
    isArticleAuthor: boolean | null
    viewerHasUpvoted: boolean | null
    viewerHasReported: boolean | null
    repliesCount: number | null
    insertedAt: unknown
    updatedAt: unknown
    author: {
      login: string | null
      nickname: string | null
      avatar: string | null
      bio: string | null
      shortbio: string | null
    } | null
    meta: {
      isLegal: boolean | null
      illegalReason: Array<string | null> | null
      illegalWords: Array<string | null> | null
      isArticleAuthorUpvoted: boolean | null
      isReplyToOthers: boolean | null
    } | null
    emotions: Array<{
      type: EmotionType | null
      count: number | null
      viewerHasReacted: boolean | null
      latestUsers: Array<{
        login: string | null
        nickname: string | null
        avatar: string | null
      } | null> | null
    } | null> | null
  } | null
}

export type CommentPageFieldsFragment = {
  totalPages: number | null
  totalCount: number | null
  pageSize: number | null
  pageNumber: number | null
}

export type PagedCommentsQueryVariables = Exact<{
  article: ArticlePathInput
  mode?: CommentsMode | null | undefined
  filter: CommentsFilter
}>

export type PagedCommentsQuery = {
  pagedComments: {
    totalPages: number | null
    totalCount: number | null
    pageSize: number | null
    pageNumber: number | null
    entries: Array<{
      innerId: string | null
      bodyHtml: string | null
      isPinned: boolean | null
      floor: number | null
      upvotesCount: number | null
      isArticleAuthor: boolean | null
      viewerHasUpvoted: boolean | null
      viewerHasReported: boolean | null
      repliesCount: number | null
      insertedAt: unknown
      updatedAt: unknown
      replyToComment: {
        innerId: string | null
        bodyHtml: string | null
        isPinned: boolean | null
        floor: number | null
        upvotesCount: number | null
        isArticleAuthor: boolean | null
        viewerHasUpvoted: boolean | null
        viewerHasReported: boolean | null
        repliesCount: number | null
        insertedAt: unknown
        updatedAt: unknown
        author: {
          login: string | null
          nickname: string | null
          avatar: string | null
          bio: string | null
          shortbio: string | null
        } | null
        meta: {
          isLegal: boolean | null
          illegalReason: Array<string | null> | null
          illegalWords: Array<string | null> | null
          isArticleAuthorUpvoted: boolean | null
          isReplyToOthers: boolean | null
        } | null
        emotions: Array<{
          type: EmotionType | null
          count: number | null
          viewerHasReacted: boolean | null
          latestUsers: Array<{
            login: string | null
            nickname: string | null
            avatar: string | null
          } | null> | null
        } | null> | null
      } | null
      replies: Array<{
        innerId: string | null
        bodyHtml: string | null
        isPinned: boolean | null
        floor: number | null
        upvotesCount: number | null
        isArticleAuthor: boolean | null
        viewerHasUpvoted: boolean | null
        viewerHasReported: boolean | null
        repliesCount: number | null
        insertedAt: unknown
        updatedAt: unknown
        author: {
          login: string | null
          nickname: string | null
          avatar: string | null
          bio: string | null
          shortbio: string | null
        } | null
        meta: {
          isLegal: boolean | null
          illegalReason: Array<string | null> | null
          illegalWords: Array<string | null> | null
          isArticleAuthorUpvoted: boolean | null
          isReplyToOthers: boolean | null
        } | null
        emotions: Array<{
          type: EmotionType | null
          count: number | null
          viewerHasReacted: boolean | null
          latestUsers: Array<{
            login: string | null
            nickname: string | null
            avatar: string | null
          } | null> | null
        } | null> | null
        replyToComment: {
          innerId: string | null
          bodyHtml: string | null
          isPinned: boolean | null
          floor: number | null
          upvotesCount: number | null
          isArticleAuthor: boolean | null
          viewerHasUpvoted: boolean | null
          viewerHasReported: boolean | null
          repliesCount: number | null
          insertedAt: unknown
          updatedAt: unknown
          author: {
            login: string | null
            nickname: string | null
            avatar: string | null
            bio: string | null
            shortbio: string | null
          } | null
          meta: {
            isLegal: boolean | null
            illegalReason: Array<string | null> | null
            illegalWords: Array<string | null> | null
            isArticleAuthorUpvoted: boolean | null
            isReplyToOthers: boolean | null
          } | null
          emotions: Array<{
            type: EmotionType | null
            count: number | null
            viewerHasReacted: boolean | null
            latestUsers: Array<{
              login: string | null
              nickname: string | null
              avatar: string | null
            } | null> | null
          } | null> | null
        } | null
      } | null> | null
      author: {
        login: string | null
        nickname: string | null
        avatar: string | null
        bio: string | null
        shortbio: string | null
      } | null
      meta: {
        isLegal: boolean | null
        illegalReason: Array<string | null> | null
        illegalWords: Array<string | null> | null
        isArticleAuthorUpvoted: boolean | null
        isReplyToOthers: boolean | null
      } | null
      emotions: Array<{
        type: EmotionType | null
        count: number | null
        viewerHasReacted: boolean | null
        latestUsers: Array<{
          login: string | null
          nickname: string | null
          avatar: string | null
        } | null> | null
      } | null> | null
    } | null> | null
  } | null
}

export type PagedCommentRepliesQueryVariables = Exact<{
  comment: CommentPathInput
  filter: CommentsFilter
}>

export type PagedCommentRepliesQuery = {
  pagedCommentReplies: {
    totalPages: number | null
    totalCount: number | null
    pageSize: number | null
    pageNumber: number | null
    entries: Array<{
      innerId: string | null
      bodyHtml: string | null
      isPinned: boolean | null
      floor: number | null
      upvotesCount: number | null
      isArticleAuthor: boolean | null
      viewerHasUpvoted: boolean | null
      viewerHasReported: boolean | null
      repliesCount: number | null
      insertedAt: unknown
      updatedAt: unknown
      author: {
        login: string | null
        nickname: string | null
        avatar: string | null
        bio: string | null
        shortbio: string | null
      } | null
      meta: {
        isLegal: boolean | null
        illegalReason: Array<string | null> | null
        illegalWords: Array<string | null> | null
        isArticleAuthorUpvoted: boolean | null
        isReplyToOthers: boolean | null
      } | null
      emotions: Array<{
        type: EmotionType | null
        count: number | null
        viewerHasReacted: boolean | null
        latestUsers: Array<{
          login: string | null
          nickname: string | null
          avatar: string | null
        } | null> | null
      } | null> | null
      replyToComment: {
        innerId: string | null
        bodyHtml: string | null
        isPinned: boolean | null
        floor: number | null
        upvotesCount: number | null
        isArticleAuthor: boolean | null
        viewerHasUpvoted: boolean | null
        viewerHasReported: boolean | null
        repliesCount: number | null
        insertedAt: unknown
        updatedAt: unknown
        author: {
          login: string | null
          nickname: string | null
          avatar: string | null
          bio: string | null
          shortbio: string | null
        } | null
        meta: {
          isLegal: boolean | null
          illegalReason: Array<string | null> | null
          illegalWords: Array<string | null> | null
          isArticleAuthorUpvoted: boolean | null
          isReplyToOthers: boolean | null
        } | null
        emotions: Array<{
          type: EmotionType | null
          count: number | null
          viewerHasReacted: boolean | null
          latestUsers: Array<{
            login: string | null
            nickname: string | null
            avatar: string | null
          } | null> | null
        } | null> | null
      } | null
    } | null> | null
  } | null
}

export type CreateCommentMutationVariables = Exact<{
  article: ArticlePathInput
  body: string
}>

export type CreateCommentMutation = {
  createComment: { innerId: string | null; bodyHtml: string | null } | null
}

export type UpdateCommentMutationVariables = Exact<{
  comment: CommentPathInput
  body: string
}>

export type UpdateCommentMutation = {
  updateComment: {
    innerId: string | null
    bodyHtml: string | null
    replyToComment: { innerId: string | null } | null
  } | null
}

export type CommentsStateQueryVariables = Exact<{
  article: ArticlePathInput
  freshkey?: string | null | undefined
}>

export type CommentsStateQuery = {
  commentsState: {
    totalCount: number | null
    isViewerJoined: boolean | null
    participantsCount: number | null
    participants: Array<{
      login: string | null
      nickname: string | null
      avatar: string | null
    } | null> | null
  } | null
}

export type OneCommentQueryVariables = Exact<{
  comment: CommentPathInput
}>

export type OneCommentQuery = { oneComment: { innerId: string | null; body: string | null } | null }

export type ReplyCommentMutationVariables = Exact<{
  comment: CommentPathInput
  body: string
}>

export type ReplyCommentMutation = {
  replyComment: { innerId: string | null; bodyHtml: string | null } | null
}

export type DeleteCommentMutationVariables = Exact<{
  comment: CommentPathInput
}>

export type DeleteCommentMutation = { deleteComment: { innerId: string | null } | null }

export type UpvoteCommentMutationVariables = Exact<{
  comment: CommentPathInput
}>

export type UpvoteCommentMutation = {
  upvoteComment: {
    innerId: string | null
    upvotesCount: number | null
    viewerHasUpvoted: boolean | null
    meta: { isArticleAuthorUpvoted: boolean | null } | null
    replyToComment: { innerId: string | null } | null
  } | null
}

export type UndoUpvoteCommentMutationVariables = Exact<{
  comment: CommentPathInput
}>

export type UndoUpvoteCommentMutation = {
  undoUpvoteComment: {
    innerId: string | null
    upvotesCount: number | null
    viewerHasUpvoted: boolean | null
    meta: { isArticleAuthorUpvoted: boolean | null } | null
    replyToComment: { innerId: string | null } | null
  } | null
}

export type ReportCommentMutationVariables = Exact<{
  comment: CommentPathInput
  reason: string
  attr?: string | null | undefined
}>

export type ReportCommentMutation = {
  reportComment: {
    innerId: string | null
    viewerHasReported: boolean | null
    meta: { reportedCount: number | null } | null
  } | null
}

export type UndoReportCommentMutationVariables = Exact<{
  comment: CommentPathInput
}>

export type UndoReportCommentMutation = {
  undoReportComment: {
    innerId: string | null
    viewerHasReported: boolean | null
    meta: { reportedCount: number | null } | null
  } | null
}

export type EmotionToCommentMutationVariables = Exact<{
  comment: CommentPathInput
  emotion: CommentEmotion
}>

export type EmotionToCommentMutation = {
  emotionToComment: {
    innerId: string | null
    replyToComment: { innerId: string | null } | null
    emotions: Array<{
      type: EmotionType | null
      count: number | null
      viewerHasReacted: boolean | null
      latestUsers: Array<{
        login: string | null
        nickname: string | null
        avatar: string | null
      } | null> | null
    } | null> | null
  } | null
}

export type UndoEmotionToCommentMutationVariables = Exact<{
  comment: CommentPathInput
  emotion: CommentEmotion
}>

export type UndoEmotionToCommentMutation = {
  undoEmotionToComment: {
    innerId: string | null
    replyToComment: { innerId: string | null } | null
    emotions: Array<{
      type: EmotionType | null
      count: number | null
      viewerHasReacted: boolean | null
      latestUsers: Array<{
        login: string | null
        nickname: string | null
        avatar: string | null
      } | null> | null
    } | null> | null
  } | null
}

export type SearchUsersQueryVariables = Exact<{
  name: string
}>

export type SearchUsersQuery = {
  searchUsers: {
    entries: Array<{
      login: string | null
      nickname: string | null
      avatar: string | null
      bio: string | null
      shortbio: string | null
    } | null> | null
  } | null
}

export type PagedPublishedCommentsQueryVariables = Exact<{
  login: string
  thread?: Thread | null | undefined
  filter: PagiFilter
}>

export type PagedPublishedCommentsQuery = {
  pagedPublishedComments: {
    totalPages: number | null
    totalCount: number | null
    pageSize: number | null
    pageNumber: number | null
    entries: Array<{
      innerId: string | null
      bodyHtml: string | null
      isPinned: boolean | null
      floor: number | null
      upvotesCount: number | null
      isArticleAuthor: boolean | null
      viewerHasUpvoted: boolean | null
      viewerHasReported: boolean | null
      repliesCount: number | null
      insertedAt: unknown
      updatedAt: unknown
      article: {
        innerId: string | null
        title: string | null
        thread: Thread | null
        author: { nickname: string | null; login: string | null } | null
      } | null
      author: {
        login: string | null
        nickname: string | null
        avatar: string | null
        bio: string | null
        shortbio: string | null
      } | null
      meta: {
        isLegal: boolean | null
        illegalReason: Array<string | null> | null
        illegalWords: Array<string | null> | null
        isArticleAuthorUpvoted: boolean | null
        isReplyToOthers: boolean | null
      } | null
      emotions: Array<{
        type: EmotionType | null
        count: number | null
        viewerHasReacted: boolean | null
        latestUsers: Array<{
          login: string | null
          nickname: string | null
          avatar: string | null
        } | null> | null
      } | null> | null
    } | null> | null
  } | null
}

export type CoverSimpleQueryQueryVariables = Exact<{
  article: ArticlePathInput
}>

export type CoverSimpleQueryQuery = { post: { innerId: string | null } }

export type AnalysisTrendPagesQueryVariables = Exact<{
  community: string
  days?: number | null | undefined
  dimension: AnalysisTrendPagesDimension
}>

export type AnalysisTrendPagesQuery = {
  analysisTrendPages: {
    status: string | null
    items: Array<{
      value: string | null
      label: string | null
      metrics: {
        visitors: number | null
        visits: number | null
        views: number | null
        bounceRate: number | null
        visitDuration: number | null
      } | null
    } | null> | null
    error: {
      code: string | null
      message: string | null
      section: string | null
      providerStatus: string | null
    } | null
  } | null
}

export type AnalysisTrendSourcesQueryVariables = Exact<{
  community: string
  days?: number | null | undefined
  dimension: AnalysisTrendSourcesDimension
}>

export type AnalysisTrendSourcesQuery = {
  analysisTrendSources: {
    status: string | null
    items: Array<{
      value: string | null
      label: string | null
      metrics: { visitors: number | null; visits: number | null; views: number | null } | null
    } | null> | null
    error: {
      code: string | null
      message: string | null
      section: string | null
      providerStatus: string | null
    } | null
  } | null
}

export type AnalysisTrendEnvironmentQueryVariables = Exact<{
  community: string
  days?: number | null | undefined
  dimension: AnalysisTrendEnvironmentDimension
}>

export type AnalysisTrendEnvironmentQuery = {
  analysisTrendEnvironment: {
    status: string | null
    items: Array<{
      value: string | null
      label: string | null
      metrics: {
        visitors: number | null
        visits: number | null
        views: number | null
        percentage: number | null
      } | null
    } | null> | null
    error: {
      code: string | null
      message: string | null
      section: string | null
      providerStatus: string | null
    } | null
  } | null
}

export type AnalysisTrendLocationQueryVariables = Exact<{
  community: string
  days?: number | null | undefined
  dimension: AnalysisTrendLocationDimension
}>

export type AnalysisTrendLocationQuery = {
  analysisTrendLocation: {
    status: string | null
    items: Array<{
      value: string | null
      label: string | null
      code: string | null
      metrics: {
        visitors: number | null
        visits: number | null
        views: number | null
        percentage: number | null
      } | null
    } | null> | null
    error: {
      code: string | null
      message: string | null
      section: string | null
      providerStatus: string | null
    } | null
  } | null
}

export type AnalysisTrendTrafficQueryVariables = Exact<{
  community: string
  days?: number | null | undefined
}>

export type AnalysisTrendTrafficQuery = {
  analysisTrendTraffic: {
    status: string | null
    timezone: string | null
    cells: Array<{
      weekday: number | null
      hour: number | null
      visitors: number | null
      visits: number | null
      views: number | null
    } | null> | null
    error: {
      code: string | null
      message: string | null
      section: string | null
      providerStatus: string | null
    } | null
  } | null
}

export type AnalysisTrendsOverviewQueryVariables = Exact<{
  community: string
  days?: number | null | undefined
}>

export type AnalysisTrendsOverviewQuery = {
  analysisTrendsOverview: {
    status: string | null
    provider: string | null
    range: { days: number | null; startAt: unknown; endAt: unknown; bucket: string | null } | null
    summary: {
      pageviews: {
        value: number | null
        previousValue: number | null
        changeRate: number | null
      } | null
      visitors: {
        value: number | null
        previousValue: number | null
        changeRate: number | null
      } | null
      visits: {
        value: number | null
        previousValue: number | null
        changeRate: number | null
      } | null
      bounceRate: {
        value: number | null
        previousValue: number | null
        changeRate: number | null
      } | null
      visitDuration: {
        value: number | null
        previousValue: number | null
        changeRate: number | null
      } | null
    } | null
    chart: {
      bucket: string | null
      points: Array<{
        timestamp: unknown
        visits: number | null
        views: number | null
      } | null> | null
    } | null
    errors: Array<{
      code: string | null
      message: string | null
      section: string | null
      providerStatus: string | null
    } | null> | null
  } | null
}

export type SaveCustomThemePresetMutationVariables = Exact<{
  community: string
  themePreset: DsbThemePreset
  themePresetBase: DsbThemePreset
  themeOverwrite?: unknown
}>

export type SaveCustomThemePresetMutation = {
  saveCustomThemePreset: {
    layout: {
      themePreset: DsbThemePreset | null
      themePresetBase: DsbThemePreset | null
      themeTokens: unknown
      themePresets: Array<{ value: DsbThemePreset; tokens: unknown } | null> | null
    } | null
  } | null
}

export type SelectThemePresetMutationVariables = Exact<{
  community: string
  themePreset: DsbThemePreset
}>

export type SelectThemePresetMutation = {
  selectThemePreset: {
    layout: {
      themePreset: DsbThemePreset | null
      themePresetBase: DsbThemePreset | null
      themeTokens: unknown
      themePresets: Array<{ value: DsbThemePreset; tokens: unknown } | null> | null
    } | null
  } | null
}

export type DashboardWallpaperFieldsFragment = {
  light: {
    type: string | null
    source: string | null
    gradient: unknown
    pattern: unknown
    contentShadow: unknown
    effect: unknown
    texture: unknown
  } | null
  dark: {
    type: string | null
    source: string | null
    gradient: unknown
    pattern: unknown
    contentShadow: unknown
    effect: unknown
    texture: unknown
  } | null
}

export type UpdateDashboardWallpaperMutationVariables = Exact<{
  community: string
  wallpaper: DsbWallpaperInput
}>

export type UpdateDashboardWallpaperMutation = {
  updateDashboardWallpaper: {
    wallpaper: {
      light: {
        type: string | null
        source: string | null
        gradient: unknown
        pattern: unknown
        contentShadow: unknown
        effect: unknown
        texture: unknown
      } | null
      dark: {
        type: string | null
        source: string | null
        gradient: unknown
        pattern: unknown
        contentShadow: unknown
        effect: unknown
        texture: unknown
      } | null
    } | null
  } | null
}

export type ContentImportJobFieldsFragment = {
  id: string
  status: ContentImportJobStatus
  progress: unknown
  errorCode: string | null
  errorMessage: string | null
  failedItems: unknown
  skipped: unknown
  targetBranch: string
  firstImportedDocRef: string | null
  tree: unknown
  badSmells: unknown
  process: {
    state: ContentImportProcessState
    stage: ContentImportProcessStage
    updatedAt: unknown
    progress: { completed: number; total: number | null; unit: ContentImportProcessUnit } | null
    recentBatch: Array<{ ref: string; label: string; state: ContentImportProcessItemState }>
  }
  sourceInfo: {
    repo: string
    repoUrl: string
    branch: string
    commit: string | null
    framework: string | null
    contentRoot: string | null
    configPaths: Array<string>
  }
  counts: { tabs: number; groups: number; pages: number; links: number; assets: number }
}

export type ContentImportJobQueryVariables = Exact<{
  community: string
  jobRef: string | number
}>

export type ContentImportJobQuery = {
  contentImportJob: {
    id: string
    status: ContentImportJobStatus
    progress: unknown
    errorCode: string | null
    errorMessage: string | null
    failedItems: unknown
    skipped: unknown
    targetBranch: string
    firstImportedDocRef: string | null
    tree: unknown
    badSmells: unknown
    process: {
      state: ContentImportProcessState
      stage: ContentImportProcessStage
      updatedAt: unknown
      progress: { completed: number; total: number | null; unit: ContentImportProcessUnit } | null
      recentBatch: Array<{ ref: string; label: string; state: ContentImportProcessItemState }>
    }
    sourceInfo: {
      repo: string
      repoUrl: string
      branch: string
      commit: string | null
      framework: string | null
      contentRoot: string | null
      configPaths: Array<string>
    }
    counts: { tabs: number; groups: number; pages: number; links: number; assets: number }
  } | null
}

export type DashboardCommunityModeratorsQueryVariables = Exact<{
  slug: string
  incViews?: boolean | null | undefined
}>

export type DashboardCommunityModeratorsQuery = {
  community: {
    moderators: Array<{
      isRoot: boolean | null
      passportItemCount: number | null
      user: {
        login: string | null
        avatar: string | null
        nickname: string | null
        bio: string | null
      } | null
    } | null> | null
  } | null
}

export type DashboardUserPassportQueryVariables = Exact<{
  login: string
}>

export type DashboardUserPassportQuery = { user: { passportString: string | null } | null }

export type DashboardSearchUsersQueryVariables = Exact<{
  name: string
}>

export type DashboardSearchUsersQuery = {
  searchUsers: {
    entries: Array<{
      login: string | null
      avatar: string | null
      nickname: string | null
      bio: string | null
      social: { github: string | null; twitter: string | null; zhihu: string | null } | null
    } | null> | null
  } | null
}

export type DashboardAddModeratorMutationVariables = Exact<{
  community: string
  user: string
}>

export type DashboardAddModeratorMutation = {
  addModerator: {
    moderators: Array<{
      isRoot: boolean | null
      passportItemCount: number | null
      user: {
        login: string | null
        avatar: string | null
        nickname: string | null
        bio: string | null
      } | null
    } | null> | null
  } | null
}

export type DashboardAddModeratorsMutationVariables = Exact<{
  community: string
  users: Array<string> | string
}>

export type DashboardAddModeratorsMutation = {
  addModerators: {
    moderators: Array<{
      isRoot: boolean | null
      passportItemCount: number | null
      user: {
        login: string | null
        avatar: string | null
        nickname: string | null
        bio: string | null
      } | null
    } | null> | null
  } | null
}

export type UpdateDashboardLayoutMutationVariables = Exact<{
  community: string
  postLayout?: DsbPostLayout | null | undefined
  kanbanLayout?: DsbKanbanLayout | null | undefined
  kanbanCardLayout?: DsbKanbanCardLayout | null | undefined
  kanbanBoards?: Array<KanbanBoard | null | undefined> | KanbanBoard | null | undefined
  footerLayout?: DsbFooterLayout | null | undefined
  headerLayout?: DsbHeaderLayout | null | undefined
  topbarEnabled?: boolean | null | undefined
  topbarBg?: RainbowColor | null | undefined
  topbarBgCustomColor?: string | null | undefined
  tagLayout?: DsbTagLayout | null | undefined
  inlineTagLayout?: DsbInlineTagLayout | null | undefined
  avatarLayout?: DsbAvatarLayout | null | undefined
  navActiveLayout?: DsbNavActiveLayout | null | undefined
  broadcastEnable?: boolean | null | undefined
  kanbanBgColors?: Array<RainbowColor | null | undefined> | RainbowColor | null | undefined
  broadcastLayout?: DsbBroadcastLayout | null | undefined
  broadcastBg?: RainbowColor | null | undefined
  broadcastCustomBg?: string | null | undefined
  broadcastArticleLayout?: DsbBroadcastArticleLayout | null | undefined
  broadcastArticleBg?: RainbowColor | null | undefined
  broadcastArticleCustomBg?: string | null | undefined
  broadcastArticleEnable?: boolean | null | undefined
  overlayDark?: boolean | null | undefined
  brandLayout?: DsbBrandLayout | null | undefined
  communityLayout?: DsbCommunityLayout | null | undefined
  changelogLayout?: DsbChangelogLayout | null | undefined
  docCoverLayout?: DsbDocCoverLayout | null | undefined
  docFaqLayout?: DsbDocFaqLayout | null | undefined
}>

export type UpdateDashboardLayoutMutation = {
  updateDashboardLayout: {
    layout: {
      postLayout: DsbPostLayout | null
      kanbanLayout: DsbKanbanLayout | null
      kanbanCardLayout: DsbKanbanCardLayout | null
      kanbanBoards: Array<KanbanBoard | null> | null
      kanbanBgColors: Array<RainbowColor | null> | null
      docCoverLayout: DsbDocCoverLayout | null
      docFaqLayout: DsbDocFaqLayout | null
      tagLayout: DsbTagLayout | null
      inlineTagLayout: DsbInlineTagLayout | null
      avatarLayout: DsbAvatarLayout | null
      brandLayout: DsbBrandLayout | null
      communityLayout: DsbCommunityLayout | null
      navActiveLayout: DsbNavActiveLayout | null
      topbarEnabled: boolean | null
      topbarBg: RainbowColor | null
      topbarBgCustomColor: string | null
      broadcastLayout: DsbBroadcastLayout | null
      broadcastBg: RainbowColor | null
      broadcastCustomBg: string | null
      broadcastEnable: boolean | null
      broadcastArticleLayout: DsbBroadcastArticleLayout | null
      broadcastArticleBg: RainbowColor | null
      broadcastArticleCustomBg: string | null
      broadcastArticleEnable: boolean | null
      changelogLayout: DsbChangelogLayout | null
      footerLayout: DsbFooterLayout | null
      headerLayout: DsbHeaderLayout | null
      overlayDark: boolean | null
    } | null
  } | null
}

export type CreateCommunityAssetUploadIntentMutationVariables = Exact<{
  community: string
  file: CommunityAssetUploadFileInput
}>

export type CreateCommunityAssetUploadIntentMutation = {
  createCommunityAssetUploadIntent: {
    uploadRef: string
    assetPublicRef: string
    objectKey: string
    capability: string
    expiresAt: unknown
    maxSizeBytes: unknown
    allowedMimeTypes: Array<string>
  } | null
}

export type PagedCommunityAssetsQueryVariables = Exact<{
  community: string
  filter?: CommunityAssetFilter | null | undefined
}>

export type PagedCommunityAssetsQuery = {
  pagedCommunityAssets: {
    pageNumber: number | null
    pageSize: number | null
    totalCount: number | null
    totalPages: number | null
    entries: Array<{
      id: string | null
      publicRef: string | null
      thread: Thread | null
      assetType: CommunityAssetType | null
      status: CommunityAssetStatus | null
      filename: string | null
      mimeType: string | null
      sizeBytes: unknown
      storage: string | null
      storageKey: string | null
      contentHash: string | null
      width: number | null
      height: number | null
      url: string | null
      deletedAt: unknown
      insertedAt: unknown
      uploader: { login: string | null; nickname: string | null } | null
    } | null> | null
  } | null
}

export type CommunityAssetStatsQueryVariables = Exact<{
  community: string
  filter?: CommunityAssetFilter | null | undefined
}>

export type CommunityAssetStatsQuery = {
  communityAssetStats: {
    totalCount: number
    storageBytes: unknown
    storageLimitBytes: unknown
    byThread: Array<{ thread: Thread; count: number }>
    byAssetType: Array<{
      assetType: CommunityAssetType
      count: number
      subtypes: Array<{ key: string; label: string; count: number }>
    }>
  } | null
}

export type CommunityAssetRefsQueryVariables = Exact<{
  community: string
  assetId: string | number
  filter?: PagiFilter | null | undefined
}>

export type CommunityAssetRefsQuery = {
  communityAssetRefs: {
    pageNumber: number | null
    pageSize: number | null
    totalCount: number | null
    totalPages: number | null
    entries: Array<{
      id: string | null
      thread: Thread | null
      articleId: string | null
      usage: ArticleDocumentAssetUsage | null
      blockId: string | null
      blockType: string | null
      position: number | null
      title: string | null
      alt: string | null
      source: string | null
      insertedAt: unknown
    } | null> | null
  } | null
}

export type DeleteCommunityAssetMutationVariables = Exact<{
  community: string
  id: string | number
}>

export type DeleteCommunityAssetMutation = {
  deleteCommunityAsset: {
    id: string | null
    publicRef: string | null
    status: CommunityAssetStatus | null
    deletedAt: unknown
  } | null
}

export type DashboardTrashedPostsQueryVariables = Exact<{
  community: string
  page: number
  size: number
}>

export type DashboardTrashedPostsQuery = {
  trashedArticles: {
    totalCount: number | null
    pageSize: number | null
    totalPages: number | null
    pageNumber: number | null
    entries: Array<{
      id: string
      thread: Thread
      articleRef: string
      deletedAt: unknown
      scheduledPermanentDeletionAt: unknown
      mentionedByCount: number
      deletedBy: {
        login: string | null
        nickname: string | null
        avatar: string | null
        bio: string | null
        shortbio: string | null
      } | null
      article:
        | {
            innerId: string | null
            title: string | null
            views: number | null
            upvotesCount: number | null
            meta: { thread: Thread | null } | null
          }
        | {
            innerId: string | null
            title: string | null
            views: number | null
            upvotesCount: number | null
            meta: { thread: Thread | null } | null
          }
        | {
            innerId: string | null
            title: string | null
            views: number | null
            upvotesCount: number | null
            meta: { thread: Thread | null } | null
          }
        | {
            cat: ArticleCatEnum | null
            status: ArticleStatusEnum | null
            commentsCount: number | null
            insertedAt: unknown
            activeAt: unknown
            innerId: string | null
            title: string | null
            views: number | null
            upvotesCount: number | null
            author: {
              login: string | null
              nickname: string | null
              avatar: string | null
              bio: string | null
              shortbio: string | null
            } | null
            communityTags: Array<{
              id: string | null
              title: string | null
              layout: string | null
              desc: string | null
              slug: string | null
              color: RainbowColor | null
              thread: Thread | null
              group: string | null
              groupId: string | null
              index: number | null
              marker: {
                type: MarkerType
                provider: string | null
                name: string | null
                src: string | null
                unified: string | null
              } | null
              community: { slug: string | null } | null
            } | null> | null
            meta: { thread: Thread | null } | null
          }
        | null
    }>
  } | null
}

export type RestoreTrashedPostMutationVariables = Exact<{
  community: string
  id: string | number
}>

export type RestoreTrashedPostMutation = {
  restoreTrashedArticle:
    | { innerId: string | null; title: string | null }
    | { innerId: string | null; title: string | null }
    | { innerId: string | null; title: string | null }
    | { innerId: string | null; title: string | null }
    | null
}

export type PermanentlyDeleteTrashedPostMutationVariables = Exact<{
  community: string
  id: string | number
}>

export type PermanentlyDeleteTrashedPostMutation = {
  permanentlyDeleteTrashedArticle: { done: boolean | null } | null
}

export type DashboardDocTreeNodeFieldsFragment = {
  id: string | null
  parentNodeId: string | null
  docId: string | null
  type: DocTreeNodeType | null
  title: string | null
  index: number | null
  href: string | null
  badge: string | null
  hidden: boolean | null
  marker: {
    type: MarkerType
    provider: string | null
    name: string | null
    src: string | null
    unified: string | null
    appearance: {
      light: { color: string | null; bg: string | null }
      dark: { color: string | null; bg: string | null }
    } | null
  } | null
  publishState: {
    status: DocPublishStatus | null
    published: boolean | null
    publishedBefore: boolean | null
    hasDraft: boolean | null
    publicNodeId: string | null
    publicDocId: string | null
    hasUnpublishedChanges: boolean | null
    lastPublishedAt: unknown
    inCover: boolean | null
    hiddenFromCover: boolean | null
    pinnedToCover: boolean | null
  } | null
}

export type DashboardDocTreeChildFieldsFragment = {
  id: string | null
  parentNodeId: string | null
  docId: string | null
  type: DocTreeNodeType | null
  title: string | null
  index: number | null
  href: string | null
  badge: string | null
  hidden: boolean | null
  pages: Array<{
    id: string | null
    parentNodeId: string | null
    docId: string | null
    type: DocTreeNodeType | null
    title: string | null
    index: number | null
    href: string | null
    badge: string | null
    hidden: boolean | null
    marker: {
      type: MarkerType
      provider: string | null
      name: string | null
      src: string | null
      unified: string | null
      appearance: {
        light: { color: string | null; bg: string | null }
        dark: { color: string | null; bg: string | null }
      } | null
    } | null
    publishState: {
      status: DocPublishStatus | null
      published: boolean | null
      publishedBefore: boolean | null
      hasDraft: boolean | null
      publicNodeId: string | null
      publicDocId: string | null
      hasUnpublishedChanges: boolean | null
      lastPublishedAt: unknown
      inCover: boolean | null
      hiddenFromCover: boolean | null
      pinnedToCover: boolean | null
    } | null
  } | null> | null
  marker: {
    type: MarkerType
    provider: string | null
    name: string | null
    src: string | null
    unified: string | null
    appearance: {
      light: { color: string | null; bg: string | null }
      dark: { color: string | null; bg: string | null }
    } | null
  } | null
  publishState: {
    status: DocPublishStatus | null
    published: boolean | null
    publishedBefore: boolean | null
    hasDraft: boolean | null
    publicNodeId: string | null
    publicDocId: string | null
    hasUnpublishedChanges: boolean | null
    lastPublishedAt: unknown
    inCover: boolean | null
    hiddenFromCover: boolean | null
    pinnedToCover: boolean | null
  } | null
}

export type DashboardDocTreeGroupFieldsFragment = {
  id: string | null
  parentNodeId: string | null
  docId: string | null
  type: DocTreeNodeType | null
  title: string | null
  index: number | null
  href: string | null
  badge: string | null
  hidden: boolean | null
  pages: Array<{
    id: string | null
    parentNodeId: string | null
    docId: string | null
    type: DocTreeNodeType | null
    title: string | null
    index: number | null
    href: string | null
    badge: string | null
    hidden: boolean | null
    pages: Array<{
      id: string | null
      parentNodeId: string | null
      docId: string | null
      type: DocTreeNodeType | null
      title: string | null
      index: number | null
      href: string | null
      badge: string | null
      hidden: boolean | null
      marker: {
        type: MarkerType
        provider: string | null
        name: string | null
        src: string | null
        unified: string | null
        appearance: {
          light: { color: string | null; bg: string | null }
          dark: { color: string | null; bg: string | null }
        } | null
      } | null
      publishState: {
        status: DocPublishStatus | null
        published: boolean | null
        publishedBefore: boolean | null
        hasDraft: boolean | null
        publicNodeId: string | null
        publicDocId: string | null
        hasUnpublishedChanges: boolean | null
        lastPublishedAt: unknown
        inCover: boolean | null
        hiddenFromCover: boolean | null
        pinnedToCover: boolean | null
      } | null
    } | null> | null
    marker: {
      type: MarkerType
      provider: string | null
      name: string | null
      src: string | null
      unified: string | null
      appearance: {
        light: { color: string | null; bg: string | null }
        dark: { color: string | null; bg: string | null }
      } | null
    } | null
    publishState: {
      status: DocPublishStatus | null
      published: boolean | null
      publishedBefore: boolean | null
      hasDraft: boolean | null
      publicNodeId: string | null
      publicDocId: string | null
      hasUnpublishedChanges: boolean | null
      lastPublishedAt: unknown
      inCover: boolean | null
      hiddenFromCover: boolean | null
      pinnedToCover: boolean | null
    } | null
  } | null> | null
  marker: {
    type: MarkerType
    provider: string | null
    name: string | null
    src: string | null
    unified: string | null
    appearance: {
      light: { color: string | null; bg: string | null }
      dark: { color: string | null; bg: string | null }
    } | null
  } | null
  publishState: {
    status: DocPublishStatus | null
    published: boolean | null
    publishedBefore: boolean | null
    hasDraft: boolean | null
    publicNodeId: string | null
    publicDocId: string | null
    hasUnpublishedChanges: boolean | null
    lastPublishedAt: unknown
    inCover: boolean | null
    hiddenFromCover: boolean | null
    pinnedToCover: boolean | null
  } | null
}

export type DashboardDocPublishChecklistItemFieldsFragment = {
  id: string
  title: string
  action: string
  selectedByDefault: boolean
  selectable: boolean
  disabledReason: string | null
}

export type DashboardDocTreeMutationPayloadFragment = {
  revision: number | null
  conflict: boolean | null
  treeState: {
    hasUnpublishedChanges: boolean | null
    stagedEventCount: number | null
    baseSnapshotId: string | null
    latestSnapshotId: string | null
    latestReleaseId: string | null
    latestReleaseNumber: number | null
    revision: number | null
  } | null
  node: {
    id: string | null
    parentNodeId: string | null
    docId: string | null
    type: DocTreeNodeType | null
    title: string | null
    index: number | null
    href: string | null
    badge: string | null
    hidden: boolean | null
    marker: {
      type: MarkerType
      provider: string | null
      name: string | null
      src: string | null
      unified: string | null
      appearance: {
        light: { color: string | null; bg: string | null }
        dark: { color: string | null; bg: string | null }
      } | null
    } | null
    publishState: {
      status: DocPublishStatus | null
      published: boolean | null
      publishedBefore: boolean | null
      hasDraft: boolean | null
      publicNodeId: string | null
      publicDocId: string | null
      hasUnpublishedChanges: boolean | null
      lastPublishedAt: unknown
      inCover: boolean | null
      hiddenFromCover: boolean | null
      pinnedToCover: boolean | null
    } | null
  } | null
  affectedNodes: Array<{
    id: string | null
    parentNodeId: string | null
    docId: string | null
    type: DocTreeNodeType | null
    title: string | null
    index: number | null
    href: string | null
    badge: string | null
    hidden: boolean | null
    marker: {
      type: MarkerType
      provider: string | null
      name: string | null
      src: string | null
      unified: string | null
      appearance: {
        light: { color: string | null; bg: string | null }
        dark: { color: string | null; bg: string | null }
      } | null
    } | null
    publishState: {
      status: DocPublishStatus | null
      published: boolean | null
      publishedBefore: boolean | null
      hasDraft: boolean | null
      publicNodeId: string | null
      publicDocId: string | null
      hasUnpublishedChanges: boolean | null
      lastPublishedAt: unknown
      inCover: boolean | null
      hiddenFromCover: boolean | null
      pinnedToCover: boolean | null
    } | null
  } | null> | null
}

export type DashboardDocTreeQueryVariables = Exact<{
  community: string
}>

export type DashboardDocTreeQuery = {
  docTree: {
    revision: number | null
    treeState: {
      hasUnpublishedChanges: boolean | null
      stagedEventCount: number | null
      baseSnapshotId: string | null
      latestSnapshotId: string | null
      latestReleaseId: string | null
      latestReleaseNumber: number | null
      revision: number | null
    } | null
    stagedEvents: Array<{
      id: string | null
      seq: number | null
      eventType: string | null
      payload: unknown
      inversePayload: unknown
      status: string | null
      insertedAt: unknown
    } | null> | null
    tabs: Array<{
      id: string | null
      parentNodeId: string | null
      docId: string | null
      type: DocTreeNodeType | null
      title: string | null
      index: number | null
      href: string | null
      badge: string | null
      hidden: boolean | null
      pins: Array<{
        id: string | null
        parentNodeId: string | null
        docId: string | null
        type: DocTreeNodeType | null
        title: string | null
        index: number | null
        href: string | null
        badge: string | null
        hidden: boolean | null
        marker: {
          type: MarkerType
          provider: string | null
          name: string | null
          src: string | null
          unified: string | null
          appearance: {
            light: { color: string | null; bg: string | null }
            dark: { color: string | null; bg: string | null }
          } | null
        } | null
        publishState: {
          status: DocPublishStatus | null
          published: boolean | null
          publishedBefore: boolean | null
          hasDraft: boolean | null
          publicNodeId: string | null
          publicDocId: string | null
          hasUnpublishedChanges: boolean | null
          lastPublishedAt: unknown
          inCover: boolean | null
          hiddenFromCover: boolean | null
          pinnedToCover: boolean | null
        } | null
      } | null> | null
      groups: Array<{
        id: string | null
        parentNodeId: string | null
        docId: string | null
        type: DocTreeNodeType | null
        title: string | null
        index: number | null
        href: string | null
        badge: string | null
        hidden: boolean | null
        pages: Array<{
          id: string | null
          parentNodeId: string | null
          docId: string | null
          type: DocTreeNodeType | null
          title: string | null
          index: number | null
          href: string | null
          badge: string | null
          hidden: boolean | null
          pages: Array<{
            id: string | null
            parentNodeId: string | null
            docId: string | null
            type: DocTreeNodeType | null
            title: string | null
            index: number | null
            href: string | null
            badge: string | null
            hidden: boolean | null
            marker: {
              type: MarkerType
              provider: string | null
              name: string | null
              src: string | null
              unified: string | null
              appearance: {
                light: { color: string | null; bg: string | null }
                dark: { color: string | null; bg: string | null }
              } | null
            } | null
            publishState: {
              status: DocPublishStatus | null
              published: boolean | null
              publishedBefore: boolean | null
              hasDraft: boolean | null
              publicNodeId: string | null
              publicDocId: string | null
              hasUnpublishedChanges: boolean | null
              lastPublishedAt: unknown
              inCover: boolean | null
              hiddenFromCover: boolean | null
              pinnedToCover: boolean | null
            } | null
          } | null> | null
          marker: {
            type: MarkerType
            provider: string | null
            name: string | null
            src: string | null
            unified: string | null
            appearance: {
              light: { color: string | null; bg: string | null }
              dark: { color: string | null; bg: string | null }
            } | null
          } | null
          publishState: {
            status: DocPublishStatus | null
            published: boolean | null
            publishedBefore: boolean | null
            hasDraft: boolean | null
            publicNodeId: string | null
            publicDocId: string | null
            hasUnpublishedChanges: boolean | null
            lastPublishedAt: unknown
            inCover: boolean | null
            hiddenFromCover: boolean | null
            pinnedToCover: boolean | null
          } | null
        } | null> | null
        marker: {
          type: MarkerType
          provider: string | null
          name: string | null
          src: string | null
          unified: string | null
          appearance: {
            light: { color: string | null; bg: string | null }
            dark: { color: string | null; bg: string | null }
          } | null
        } | null
        publishState: {
          status: DocPublishStatus | null
          published: boolean | null
          publishedBefore: boolean | null
          hasDraft: boolean | null
          publicNodeId: string | null
          publicDocId: string | null
          hasUnpublishedChanges: boolean | null
          lastPublishedAt: unknown
          inCover: boolean | null
          hiddenFromCover: boolean | null
          pinnedToCover: boolean | null
        } | null
      } | null> | null
      marker: {
        type: MarkerType
        provider: string | null
        name: string | null
        src: string | null
        unified: string | null
        appearance: {
          light: { color: string | null; bg: string | null }
          dark: { color: string | null; bg: string | null }
        } | null
      } | null
      publishState: {
        status: DocPublishStatus | null
        published: boolean | null
        publishedBefore: boolean | null
        hasDraft: boolean | null
        publicNodeId: string | null
        publicDocId: string | null
        hasUnpublishedChanges: boolean | null
        lastPublishedAt: unknown
        inCover: boolean | null
        hiddenFromCover: boolean | null
        pinnedToCover: boolean | null
      } | null
    } | null> | null
  } | null
}

export type DashboardDocPublishChecklistQueryVariables = Exact<{
  community: string
}>

export type DashboardDocPublishChecklistQuery = {
  docPublishChecklist: {
    totalCount: number
    docChanges: Array<{
      id: string
      title: string
      action: string
      selectedByDefault: boolean
      selectable: boolean
      disabledReason: string | null
    }>
    treeChanges: Array<{
      id: string
      title: string
      action: string
      selectedByDefault: boolean
      selectable: boolean
      disabledReason: string | null
    }>
  } | null
}

export type DocTreeTrashItemsQueryVariables = Exact<{
  community: string
}>

export type DocTreeTrashItemsQuery = {
  docTreeTrashItems: Array<{
    id: string
    nodeId: string
    docId: string | null
    type: string | null
    title: string | null
    deletedFromParentNodeId: string | null
    deletedFromIndex: number | null
    deletedAt: unknown
    restoredAt: unknown
  } | null> | null
}

export type DocDraftQueryVariables = Exact<{
  community: string
  id: string | number
}>

export type DocDraftQuery = {
  docDraft: {
    id: string | null
    docId: string | null
    title: string | null
    subtitle: string | null
    slug: string | null
    stage: ArticleSnapshotStage | null
    digest: string | null
    insertedAt: unknown
    updatedAt: unknown
    author: { login: string | null; nickname: string | null; avatar: string | null } | null
    document: {
      json: string | null
      markdown: string | null
      markdownToc: unknown
      html: string | null
    } | null
  } | null
}

export type DocDraftSnapshotsQueryVariables = Exact<{
  community: string
  id: string | number
  stage?: ArticleSnapshotStage | null | undefined
}>

export type DocDraftSnapshotsQuery = {
  docDraftSnapshots: Array<{
    id: string | null
    thread: Thread | null
    stage: ArticleSnapshotStage | null
    action: ArticleSnapshotAction | null
    articleHashId: string | null
    title: string | null
    slug: string | null
    subtitle: string | null
    digest: string | null
    documentJson: string | null
    versionHash: string | null
    revisionNumber: number | null
    schemaVersion: number | null
    insertedAt: unknown
    author: { login: string | null; nickname: string | null; avatar: string | null } | null
  } | null> | null
}

export type CreateDocTreeNodeMutationVariables = Exact<{
  community: string
  baseRevision: number
  parentNodeId?: string | number | null | undefined
  input: DocTreeNodeInput
}>

export type CreateDocTreeNodeMutation = {
  createDocTreeNode: {
    revision: number | null
    conflict: boolean | null
    treeState: {
      hasUnpublishedChanges: boolean | null
      stagedEventCount: number | null
      baseSnapshotId: string | null
      latestSnapshotId: string | null
      latestReleaseId: string | null
      latestReleaseNumber: number | null
      revision: number | null
    } | null
    node: {
      id: string | null
      parentNodeId: string | null
      docId: string | null
      type: DocTreeNodeType | null
      title: string | null
      index: number | null
      href: string | null
      badge: string | null
      hidden: boolean | null
      marker: {
        type: MarkerType
        provider: string | null
        name: string | null
        src: string | null
        unified: string | null
        appearance: {
          light: { color: string | null; bg: string | null }
          dark: { color: string | null; bg: string | null }
        } | null
      } | null
      publishState: {
        status: DocPublishStatus | null
        published: boolean | null
        publishedBefore: boolean | null
        hasDraft: boolean | null
        publicNodeId: string | null
        publicDocId: string | null
        hasUnpublishedChanges: boolean | null
        lastPublishedAt: unknown
        inCover: boolean | null
        hiddenFromCover: boolean | null
        pinnedToCover: boolean | null
      } | null
    } | null
    affectedNodes: Array<{
      id: string | null
      parentNodeId: string | null
      docId: string | null
      type: DocTreeNodeType | null
      title: string | null
      index: number | null
      href: string | null
      badge: string | null
      hidden: boolean | null
      marker: {
        type: MarkerType
        provider: string | null
        name: string | null
        src: string | null
        unified: string | null
        appearance: {
          light: { color: string | null; bg: string | null }
          dark: { color: string | null; bg: string | null }
        } | null
      } | null
      publishState: {
        status: DocPublishStatus | null
        published: boolean | null
        publishedBefore: boolean | null
        hasDraft: boolean | null
        publicNodeId: string | null
        publicDocId: string | null
        hasUnpublishedChanges: boolean | null
        lastPublishedAt: unknown
        inCover: boolean | null
        hiddenFromCover: boolean | null
        pinnedToCover: boolean | null
      } | null
    } | null> | null
  } | null
}

export type UpdateDocTreeNodeMutationVariables = Exact<{
  community: string
  id: string | number
  baseRevision: number
  patch: DocTreeNodePatchInput
}>

export type UpdateDocTreeNodeMutation = {
  updateDocTreeNode: {
    revision: number | null
    conflict: boolean | null
    treeState: {
      hasUnpublishedChanges: boolean | null
      stagedEventCount: number | null
      baseSnapshotId: string | null
      latestSnapshotId: string | null
      latestReleaseId: string | null
      latestReleaseNumber: number | null
      revision: number | null
    } | null
    node: {
      id: string | null
      parentNodeId: string | null
      docId: string | null
      type: DocTreeNodeType | null
      title: string | null
      index: number | null
      href: string | null
      badge: string | null
      hidden: boolean | null
      marker: {
        type: MarkerType
        provider: string | null
        name: string | null
        src: string | null
        unified: string | null
        appearance: {
          light: { color: string | null; bg: string | null }
          dark: { color: string | null; bg: string | null }
        } | null
      } | null
      publishState: {
        status: DocPublishStatus | null
        published: boolean | null
        publishedBefore: boolean | null
        hasDraft: boolean | null
        publicNodeId: string | null
        publicDocId: string | null
        hasUnpublishedChanges: boolean | null
        lastPublishedAt: unknown
        inCover: boolean | null
        hiddenFromCover: boolean | null
        pinnedToCover: boolean | null
      } | null
    } | null
    affectedNodes: Array<{
      id: string | null
      parentNodeId: string | null
      docId: string | null
      type: DocTreeNodeType | null
      title: string | null
      index: number | null
      href: string | null
      badge: string | null
      hidden: boolean | null
      marker: {
        type: MarkerType
        provider: string | null
        name: string | null
        src: string | null
        unified: string | null
        appearance: {
          light: { color: string | null; bg: string | null }
          dark: { color: string | null; bg: string | null }
        } | null
      } | null
      publishState: {
        status: DocPublishStatus | null
        published: boolean | null
        publishedBefore: boolean | null
        hasDraft: boolean | null
        publicNodeId: string | null
        publicDocId: string | null
        hasUnpublishedChanges: boolean | null
        lastPublishedAt: unknown
        inCover: boolean | null
        hiddenFromCover: boolean | null
        pinnedToCover: boolean | null
      } | null
    } | null> | null
  } | null
}

export type UpdateDocDraftMutationVariables = Exact<{
  community: string
  id: string | number
  title?: string | null | undefined
  subtitle?: string | null | undefined
  slug?: string | null | undefined
  bodyBag?: ArtimentBodyBagInput | null | undefined
}>

export type UpdateDocDraftMutation = {
  updateDocDraft: {
    id: string | null
    docId: string | null
    title: string | null
    subtitle: string | null
    slug: string | null
    digest: string | null
    insertedAt: unknown
    updatedAt: unknown
    author: { login: string | null; nickname: string | null; avatar: string | null } | null
    document: {
      json: string | null
      markdown: string | null
      markdownToc: unknown
      html: string | null
    } | null
  } | null
}

export type CheckpointDocDraftSnapshotMutationVariables = Exact<{
  community: string
  id: string | number
}>

export type CheckpointDocDraftSnapshotMutation = {
  checkpointDocDraftSnapshot: {
    id: string | null
    thread: Thread | null
    stage: ArticleSnapshotStage | null
    action: ArticleSnapshotAction | null
    articleHashId: string | null
    title: string | null
    slug: string | null
    subtitle: string | null
    documentJson: string | null
    digest: string | null
    versionHash: string | null
    revisionNumber: number | null
    schemaVersion: number | null
    insertedAt: unknown
    author: { login: string | null; nickname: string | null; avatar: string | null } | null
  } | null
}

export type PublishDocChangesMutationVariables = Exact<{
  community: string
  input?: DocPublishChangesInput | null | undefined
  mode?: DocPublishMode | null | undefined
}>

export type PublishDocChangesMutation = {
  publishDocChanges: {
    done: boolean
    release: { id: string; releaseNumber: number; publishedAt: unknown } | null
    checklist: {
      totalCount: number
      docChanges: Array<{
        id: string
        title: string
        action: string
        selectedByDefault: boolean
        selectable: boolean
        disabledReason: string | null
      }>
      treeChanges: Array<{
        id: string
        title: string
        action: string
        selectedByDefault: boolean
        selectable: boolean
        disabledReason: string | null
      }>
    }
  } | null
}

export type MoveDocToDraftMutationVariables = Exact<{
  community: string
  id: string | number
}>

export type MoveDocToDraftMutation = {
  moveDocToDraft: {
    docId: string | null
    stage: ArticleSnapshotStage | null
    publishState: {
      status: DocPublishStatus | null
      published: boolean | null
      publishedBefore: boolean | null
      hasDraft: boolean | null
      publicNodeId: string | null
      publicDocId: string | null
      hasUnpublishedChanges: boolean | null
      lastPublishedAt: unknown
      inCover: boolean | null
      hiddenFromCover: boolean | null
      pinnedToCover: boolean | null
    } | null
  } | null
}

export type MoveDocTreeSubtreeToDraftMutationVariables = Exact<{
  community: string
  nodeId: string | number
}>

export type MoveDocTreeSubtreeToDraftMutation = {
  moveDocTreeSubtreeToDraft: { done: boolean | null } | null
}

export type RestoreDocDraftSnapshotMutationVariables = Exact<{
  community: string
  id: string | number
  snapshotId: string | number
}>

export type RestoreDocDraftSnapshotMutation = {
  restoreDocDraftSnapshot: {
    id: string | null
    title: string | null
    subtitle: string | null
    slug: string | null
    digest: string | null
    insertedAt: unknown
    updatedAt: unknown
    author: { login: string | null; nickname: string | null; avatar: string | null } | null
    document: {
      json: string | null
      markdown: string | null
      markdownToc: unknown
      html: string | null
    } | null
  } | null
}

export type DeleteDocTreeNodeMutationVariables = Exact<{
  community: string
  id: string | number
  baseRevision: number
}>

export type DeleteDocTreeNodeMutation = {
  deleteDocTreeNode: {
    revision: number | null
    conflict: boolean | null
    treeState: {
      hasUnpublishedChanges: boolean | null
      stagedEventCount: number | null
      baseSnapshotId: string | null
      latestSnapshotId: string | null
      latestReleaseId: string | null
      latestReleaseNumber: number | null
      revision: number | null
    } | null
    node: {
      id: string | null
      parentNodeId: string | null
      docId: string | null
      type: DocTreeNodeType | null
      title: string | null
      index: number | null
      href: string | null
      badge: string | null
      hidden: boolean | null
      marker: {
        type: MarkerType
        provider: string | null
        name: string | null
        src: string | null
        unified: string | null
        appearance: {
          light: { color: string | null; bg: string | null }
          dark: { color: string | null; bg: string | null }
        } | null
      } | null
      publishState: {
        status: DocPublishStatus | null
        published: boolean | null
        publishedBefore: boolean | null
        hasDraft: boolean | null
        publicNodeId: string | null
        publicDocId: string | null
        hasUnpublishedChanges: boolean | null
        lastPublishedAt: unknown
        inCover: boolean | null
        hiddenFromCover: boolean | null
        pinnedToCover: boolean | null
      } | null
    } | null
    affectedNodes: Array<{
      id: string | null
      parentNodeId: string | null
      docId: string | null
      type: DocTreeNodeType | null
      title: string | null
      index: number | null
      href: string | null
      badge: string | null
      hidden: boolean | null
      marker: {
        type: MarkerType
        provider: string | null
        name: string | null
        src: string | null
        unified: string | null
        appearance: {
          light: { color: string | null; bg: string | null }
          dark: { color: string | null; bg: string | null }
        } | null
      } | null
      publishState: {
        status: DocPublishStatus | null
        published: boolean | null
        publishedBefore: boolean | null
        hasDraft: boolean | null
        publicNodeId: string | null
        publicDocId: string | null
        hasUnpublishedChanges: boolean | null
        lastPublishedAt: unknown
        inCover: boolean | null
        hiddenFromCover: boolean | null
        pinnedToCover: boolean | null
      } | null
    } | null> | null
  } | null
}

export type RestoreDocTreeTrashItemMutationVariables = Exact<{
  community: string
  id: string | number
  baseRevision: number
  targetParentNodeId?: string | number | null | undefined
  targetIndex?: number | null | undefined
}>

export type RestoreDocTreeTrashItemMutation = {
  restoreDocTreeTrashItem: {
    revision: number | null
    conflict: boolean | null
    treeState: {
      hasUnpublishedChanges: boolean | null
      stagedEventCount: number | null
      baseSnapshotId: string | null
      latestSnapshotId: string | null
      latestReleaseId: string | null
      latestReleaseNumber: number | null
      revision: number | null
    } | null
    node: {
      id: string | null
      parentNodeId: string | null
      docId: string | null
      type: DocTreeNodeType | null
      title: string | null
      index: number | null
      href: string | null
      badge: string | null
      hidden: boolean | null
      marker: {
        type: MarkerType
        provider: string | null
        name: string | null
        src: string | null
        unified: string | null
        appearance: {
          light: { color: string | null; bg: string | null }
          dark: { color: string | null; bg: string | null }
        } | null
      } | null
      publishState: {
        status: DocPublishStatus | null
        published: boolean | null
        publishedBefore: boolean | null
        hasDraft: boolean | null
        publicNodeId: string | null
        publicDocId: string | null
        hasUnpublishedChanges: boolean | null
        lastPublishedAt: unknown
        inCover: boolean | null
        hiddenFromCover: boolean | null
        pinnedToCover: boolean | null
      } | null
    } | null
    affectedNodes: Array<{
      id: string | null
      parentNodeId: string | null
      docId: string | null
      type: DocTreeNodeType | null
      title: string | null
      index: number | null
      href: string | null
      badge: string | null
      hidden: boolean | null
      marker: {
        type: MarkerType
        provider: string | null
        name: string | null
        src: string | null
        unified: string | null
        appearance: {
          light: { color: string | null; bg: string | null }
          dark: { color: string | null; bg: string | null }
        } | null
      } | null
      publishState: {
        status: DocPublishStatus | null
        published: boolean | null
        publishedBefore: boolean | null
        hasDraft: boolean | null
        publicNodeId: string | null
        publicDocId: string | null
        hasUnpublishedChanges: boolean | null
        lastPublishedAt: unknown
        inCover: boolean | null
        hiddenFromCover: boolean | null
        pinnedToCover: boolean | null
      } | null
    } | null> | null
  } | null
}

export type DuplicateDocTreeNodeMutationVariables = Exact<{
  community: string
  id: string | number
  baseRevision: number
}>

export type DuplicateDocTreeNodeMutation = {
  duplicateDocTreeNode: {
    revision: number | null
    conflict: boolean | null
    treeState: {
      hasUnpublishedChanges: boolean | null
      stagedEventCount: number | null
      baseSnapshotId: string | null
      latestSnapshotId: string | null
      latestReleaseId: string | null
      latestReleaseNumber: number | null
      revision: number | null
    } | null
    node: {
      id: string | null
      parentNodeId: string | null
      docId: string | null
      type: DocTreeNodeType | null
      title: string | null
      index: number | null
      href: string | null
      badge: string | null
      hidden: boolean | null
      marker: {
        type: MarkerType
        provider: string | null
        name: string | null
        src: string | null
        unified: string | null
        appearance: {
          light: { color: string | null; bg: string | null }
          dark: { color: string | null; bg: string | null }
        } | null
      } | null
      publishState: {
        status: DocPublishStatus | null
        published: boolean | null
        publishedBefore: boolean | null
        hasDraft: boolean | null
        publicNodeId: string | null
        publicDocId: string | null
        hasUnpublishedChanges: boolean | null
        lastPublishedAt: unknown
        inCover: boolean | null
        hiddenFromCover: boolean | null
        pinnedToCover: boolean | null
      } | null
    } | null
    affectedNodes: Array<{
      id: string | null
      parentNodeId: string | null
      docId: string | null
      type: DocTreeNodeType | null
      title: string | null
      index: number | null
      href: string | null
      badge: string | null
      hidden: boolean | null
      marker: {
        type: MarkerType
        provider: string | null
        name: string | null
        src: string | null
        unified: string | null
        appearance: {
          light: { color: string | null; bg: string | null }
          dark: { color: string | null; bg: string | null }
        } | null
      } | null
      publishState: {
        status: DocPublishStatus | null
        published: boolean | null
        publishedBefore: boolean | null
        hasDraft: boolean | null
        publicNodeId: string | null
        publicDocId: string | null
        hasUnpublishedChanges: boolean | null
        lastPublishedAt: unknown
        inCover: boolean | null
        hiddenFromCover: boolean | null
        pinnedToCover: boolean | null
      } | null
    } | null> | null
  } | null
}

export type MoveDocTreeNodeMutationVariables = Exact<{
  community: string
  id: string | number
  baseRevision: number
  targetParentNodeId?: string | number | null | undefined
  targetIndex?: number | null | undefined
}>

export type MoveDocTreeNodeMutation = {
  moveDocTreeNode: {
    revision: number | null
    conflict: boolean | null
    treeState: {
      hasUnpublishedChanges: boolean | null
      stagedEventCount: number | null
      baseSnapshotId: string | null
      latestSnapshotId: string | null
      latestReleaseId: string | null
      latestReleaseNumber: number | null
      revision: number | null
    } | null
    node: {
      id: string | null
      parentNodeId: string | null
      docId: string | null
      type: DocTreeNodeType | null
      title: string | null
      index: number | null
      href: string | null
      badge: string | null
      hidden: boolean | null
      marker: {
        type: MarkerType
        provider: string | null
        name: string | null
        src: string | null
        unified: string | null
        appearance: {
          light: { color: string | null; bg: string | null }
          dark: { color: string | null; bg: string | null }
        } | null
      } | null
      publishState: {
        status: DocPublishStatus | null
        published: boolean | null
        publishedBefore: boolean | null
        hasDraft: boolean | null
        publicNodeId: string | null
        publicDocId: string | null
        hasUnpublishedChanges: boolean | null
        lastPublishedAt: unknown
        inCover: boolean | null
        hiddenFromCover: boolean | null
        pinnedToCover: boolean | null
      } | null
    } | null
    affectedNodes: Array<{
      id: string | null
      parentNodeId: string | null
      docId: string | null
      type: DocTreeNodeType | null
      title: string | null
      index: number | null
      href: string | null
      badge: string | null
      hidden: boolean | null
      marker: {
        type: MarkerType
        provider: string | null
        name: string | null
        src: string | null
        unified: string | null
        appearance: {
          light: { color: string | null; bg: string | null }
          dark: { color: string | null; bg: string | null }
        } | null
      } | null
      publishState: {
        status: DocPublishStatus | null
        published: boolean | null
        publishedBefore: boolean | null
        hasDraft: boolean | null
        publicNodeId: string | null
        publicDocId: string | null
        hasUnpublishedChanges: boolean | null
        lastPublishedAt: unknown
        inCover: boolean | null
        hiddenFromCover: boolean | null
        pinnedToCover: boolean | null
      } | null
    } | null> | null
  } | null
}

export type AddDocCoverCardMutationVariables = Exact<{
  community: string
  groupNodeId: string | number
}>

export type AddDocCoverCardMutation = {
  addDocCoverCard: { id: string; index: number; appearance: unknown } | null
}

export type RemoveDocCoverCardMutationVariables = Exact<{
  community: string
  groupNodeId: string | number
}>

export type RemoveDocCoverCardMutation = {
  removeDocCoverCard: { id: string; index: number; appearance: unknown } | null
}

export type ReorderDocCoverCardsMutationVariables = Exact<{
  community: string
  ids: Array<string | number> | string | number
}>

export type ReorderDocCoverCardsMutation = { reorderDocCoverCards: { done: boolean | null } | null }

export type PinDocToCoverMutationVariables = Exact<{
  community: string
  nodeId: string | number
}>

export type PinDocToCoverMutation = {
  pinDocToCover: { nodeId: string; index: number; appearance: unknown }
}

export type UnpinDocFromCoverMutationVariables = Exact<{
  community: string
  nodeId: string | number
}>

export type UnpinDocFromCoverMutation = { unpinDocFromCover: { nodeId: string } }

export type ReorderDocCoverPinnedDocsMutationVariables = Exact<{
  community: string
  nodeIds: Array<string | number> | string | number
}>

export type ReorderDocCoverPinnedDocsMutation = {
  reorderDocCoverPinnedDocs: { done: boolean | null }
}

export type UpdateDocCoverCardAppearanceMutationVariables = Exact<{
  community: string
  id: string | number
  appearance: unknown
}>

export type UpdateDocCoverCardAppearanceMutation = {
  updateDocCoverCardAppearance: { id: string; appearance: unknown } | null
}

export type UpdatePinnedDocAppearanceMutationVariables = Exact<{
  community: string
  nodeId: string | number
  appearance: unknown
}>

export type UpdatePinnedDocAppearanceMutation = {
  updatePinnedDocAppearance: { nodeId: string; appearance: unknown }
}

export type DashboardAuthorFieldsFragment = {
  login: string | null
  nickname: string | null
  avatar: string | null
  bio: string | null
  shortbio: string | null
}

export type DashboardTagFieldsFragment = {
  id: string | null
  title: string | null
  layout: string | null
  desc: string | null
  slug: string | null
  color: RainbowColor | null
  thread: Thread | null
  group: string | null
  groupId: string | null
  index: number | null
  marker: {
    type: MarkerType
    provider: string | null
    name: string | null
    src: string | null
    unified: string | null
  } | null
  community: { slug: string | null } | null
}

export type DashboardThirdPartyAnalyticsFieldsFragment = {
  provider: string | null
  enabled: boolean | null
  measurementId: string | null
  containerId: string | null
  projectId: string | null
  domain: string | null
  siteId: string | null
}

export type DashboardHeaderLinkFieldsFragment = {
  id: string | null
  type: DsbLinkType | null
  title: string | null
  url: string | null
  links: Array<{ id: string | null; title: string | null; url: string | null } | null> | null
}

export type DashboardFooterOnelineLinkFieldsFragment = {
  id: string | null
  title: string | null
  url: string | null
}

export type DashboardTrashedArticlesPageInfoFragment = {
  totalCount: number | null
  pageSize: number | null
  totalPages: number | null
  pageNumber: number | null
}

export type DashboardPressConfigQueryVariables = Exact<{
  community: string
}>

export type DashboardPressConfigQuery = {
  pressConfig: {
    markdownEnabled: boolean
    feedEnabled: boolean
    feedType: PressFeedType
    feedCount: number
    feedThreads: Array<Thread>
    llmsEnabled: boolean
    sitemapEnabled: boolean
    revision: number
  } | null
}

export type UpdateDashboardPressConfigMutationVariables = Exact<{
  input: UpdatePressConfigInput
}>

export type UpdateDashboardPressConfigMutation = {
  updatePressConfig: {
    config: {
      markdownEnabled: boolean
      feedEnabled: boolean
      feedType: PressFeedType
      feedCount: number
      feedThreads: Array<Thread>
      llmsEnabled: boolean
      sitemapEnabled: boolean
      revision: number
    }
  } | null
}

export type DashboardThirdPartyAnalyticsProvidersQueryVariables = Exact<{ [key: string]: never }>

export type DashboardThirdPartyAnalyticsProvidersQuery = {
  thirdPartyAnalyticsProviders: Array<{
    provider: string | null
    title: string | null
    desc: string | null
    detail: string | null
    docsUrl: string | null
    icon: string | null
    identityField: string | null
    configFields: Array<{
      key: string | null
      label: string | null
      desc: string | null
      placeholder: string | null
      requiredWhenEnabled: boolean | null
      pattern: string | null
    } | null> | null
  }>
}

export type DashboardOpenGraphInfoQueryVariables = Exact<{
  url: string
}>

export type DashboardOpenGraphInfoQuery = {
  openGraphInfo: {
    title: string | null
    favicon: string | null
    url: string | null
    siteName: string | null
  } | null
}

export type UpdateDashboardBaseInfoMutationVariables = Exact<{
  community: string
  homepage?: string | null | undefined
  title?: string | null | undefined
  slug?: string | null | undefined
  desc?: string | null | undefined
  locale?: string | null | undefined
  introduction?: string | null | undefined
  logo?: string | null | undefined
  favicon?: string | null | undefined
  city?: string | null | undefined
  techstack?: string | null | undefined
}>

export type UpdateDashboardBaseInfoMutation = {
  updateDashboardBaseInfo: {
    baseInfo: {
      title: string | null
      logo: string | null
      favicon: string | null
      locale: string | null
    } | null
  } | null
}

export type UpdateDashboardMediaReportsMutationVariables = Exact<{
  community: string
  mediaReports?: Array<DsbMediaReportMap | null | undefined> | DsbMediaReportMap | null | undefined
}>

export type UpdateDashboardMediaReportsMutation = {
  updateDashboardMediaReports: {
    mediaReports: Array<{
      index: number | null
      title: string | null
      url: string | null
      favicon: string | null
      siteName: string | null
    } | null> | null
  } | null
}

export type UpdateDashboardThirdPartyAnalyticsMutationVariables = Exact<{
  community: string
  thirdPartyAnalytics?:
    | Array<DsbThirdPartyAnalyticsInput | null | undefined>
    | DsbThirdPartyAnalyticsInput
    | null
    | undefined
}>

export type UpdateDashboardThirdPartyAnalyticsMutation = {
  updateDashboardThirdPartyAnalytics: {
    thirdPartyAnalytics: Array<{
      provider: string | null
      enabled: boolean | null
      measurementId: string | null
      containerId: string | null
      projectId: string | null
      domain: string | null
      siteId: string | null
    } | null> | null
  } | null
}

export type UpdateDashboardSeoMutationVariables = Exact<{
  community: string
  seoEnable?: boolean | null | undefined
  ogSiteName?: string | null | undefined
  ogTitle?: string | null | undefined
  ogDescription?: string | null | undefined
  ogUrl?: string | null | undefined
  ogImage?: string | null | undefined
  ogLocale?: string | null | undefined
  ogPublisher?: string | null | undefined
  twTitle?: string | null | undefined
  twDescription?: string | null | undefined
  twUrl?: string | null | undefined
  twCard?: string | null | undefined
  twSite?: string | null | undefined
  twImage?: string | null | undefined
  twImageWidth?: string | null | undefined
  twImageHeight?: string | null | undefined
}>

export type UpdateDashboardSeoMutation = {
  updateDashboardSeo: { seo: { seoEnable: boolean | null } | null } | null
}

export type UpdateDashboardEnableMutationVariables = Exact<{
  community: string
  post?: boolean | null | undefined
  changelog?: boolean | null | undefined
  about?: boolean | null | undefined
}>

export type UpdateDashboardEnableMutation = {
  updateDashboardEnable: {
    enable: { post: boolean | null; changelog: boolean | null; about: boolean | null } | null
  } | null
}

export type UpdateDashboardSocialLinksMutationVariables = Exact<{
  community: string
  socialLinks?: Array<DsbSocialLinkMap | null | undefined> | DsbSocialLinkMap | null | undefined
}>

export type UpdateDashboardSocialLinksMutation = {
  updateDashboardSocialLinks: {
    socialLinks: Array<{ type: string | null; link: string | null } | null> | null
  } | null
}

export type UpdateDashboardNameAliasMutationVariables = Exact<{
  community: string
  nameAlias?: Array<DsbAliasMap | null | undefined> | DsbAliasMap | null | undefined
}>

export type UpdateDashboardNameAliasMutation = {
  updateDashboardNameAlias: {
    nameAlias: Array<{
      original: string | null
      name: string | null
      slug: string | null
      group: string | null
    } | null> | null
  } | null
}

export type UpdateDashboardDocFaqMutationVariables = Exact<{
  community: string
  docFaq: DsbDocFaqInput
}>

export type UpdateDashboardDocFaqMutation = {
  updateDashboardDocFaq: {
    docFaq: {
      title: string | null
      desc: string | null
      groupedView: boolean | null
      groupItems: Array<{
        id: string | null
        title: string | null
        index: number | null
        items: Array<{
          id: string | null
          title: string | null
          detail: string | null
          index: number | null
        } | null> | null
      } | null> | null
      flatItems: Array<{
        id: string | null
        title: string | null
        detail: string | null
        index: number | null
      } | null> | null
    } | null
  } | null
}

export type UpdateDashboardHeaderLinksMutationVariables = Exact<{
  community: string
  headerLinks?: Array<DsbLinkMap | null | undefined> | DsbLinkMap | null | undefined
}>

export type UpdateDashboardHeaderLinksMutation = {
  updateDashboardHeaderLinks: {
    headerLinks: Array<{
      id: string | null
      type: DsbLinkType | null
      title: string | null
      url: string | null
      links: Array<{ id: string | null; title: string | null; url: string | null } | null> | null
    } | null> | null
  } | null
}

export type UpdateDashboardFooterLinksMutationVariables = Exact<{
  community: string
  footerLinks?: Array<DsbLinkMap | null | undefined> | DsbLinkMap | null | undefined
}>

export type UpdateDashboardFooterLinksMutation = {
  updateDashboardFooterLinks: {
    footerLinks: Array<{
      id: string | null
      type: DsbLinkType | null
      title: string | null
      url: string | null
      links: Array<{ id: string | null; title: string | null; url: string | null } | null> | null
    } | null> | null
  } | null
}

export type UpdateDashboardFooterOnelineLinksMutationVariables = Exact<{
  community: string
  footerOnelineLinks?:
    | Array<DsbLinkChildMap | null | undefined>
    | DsbLinkChildMap
    | null
    | undefined
}>

export type UpdateDashboardFooterOnelineLinksMutation = {
  updateDashboardFooterOnelineLinks: {
    footerOnelineLinks: Array<{
      id: string | null
      title: string | null
      url: string | null
    } | null> | null
  } | null
}

export type DashboardCommunityBaseInfoQueryVariables = Exact<{
  slug: string
  incViews?: boolean | null | undefined
}>

export type DashboardCommunityBaseInfoQuery = {
  community: {
    dashboard: {
      baseInfo: {
        title: string | null
        locale: string | null
        favicon: string | null
        logo: string | null
        slug: string | null
        desc: string | null
        introduction: string | null
        homepage: string | null
        city: string | null
        techstack: string | null
      } | null
      mediaReports: Array<{
        url: string | null
        title: string | null
        siteName: string | null
        favicon: string | null
        index: number | null
      } | null> | null
    } | null
  } | null
}

export type DashboardCommunitySocialLinksQueryVariables = Exact<{
  slug: string
  incViews?: boolean | null | undefined
}>

export type DashboardCommunitySocialLinksQuery = {
  community: {
    dashboard: {
      socialLinks: Array<{ type: string | null; link: string | null } | null> | null
    } | null
  } | null
}

export type DashboardCommunityOverviewQueryVariables = Exact<{
  slug: string
  incViews?: boolean | null | undefined
}>

export type DashboardCommunityOverviewQuery = {
  community: {
    views: number | null
    subscribersCount: number | null
    meta: {
      postsCount: number | null
      changelogsCount: number | null
      docsCount: number | null
    } | null
  } | null
}

export type DashboardCommunityTagGroupsQueryVariables = Exact<{
  community: string
  thread?: Thread | null | undefined
}>

export type DashboardCommunityTagGroupsQuery = {
  communityTagGroups: Array<{
    id: string | null
    title: string | null
    index: number | null
    tags: Array<{
      id: string | null
      title: string | null
      layout: string | null
      desc: string | null
      slug: string | null
      color: RainbowColor | null
      thread: Thread | null
      group: string | null
      groupId: string | null
      index: number | null
      marker: {
        type: MarkerType
        provider: string | null
        name: string | null
        src: string | null
        unified: string | null
      } | null
      community: { slug: string | null } | null
    } | null> | null
  } | null> | null
}

export type DashboardUpdateCommunityTagMutationVariables = Exact<{
  id: string | number
  color?: RainbowColor | null | undefined
  title?: string | null | undefined
  slug?: string | null | undefined
  community: string
  extra?: Array<string | null | undefined> | string | null | undefined
  marker?: MarkerInput | null | undefined
  groupId?: string | number | null | undefined
}>

export type DashboardUpdateCommunityTagMutation = {
  updateCommunityTag: {
    id: string | null
    title: string | null
    slug: string | null
    color: RainbowColor | null
    groupId: string | null
    extra: Array<string | null> | null
    marker: {
      type: MarkerType
      provider: string | null
      name: string | null
      src: string | null
      unified: string | null
    } | null
  } | null
}

export type DashboardCreateCommunityTagGroupMutationVariables = Exact<{
  thread: Thread
  title: string
  community: string
}>

export type DashboardCreateCommunityTagGroupMutation = {
  createCommunityTagGroup: {
    id: string | null
    title: string | null
    index: number | null
    tags: Array<{
      id: string | null
      title: string | null
      layout: string | null
      desc: string | null
      slug: string | null
      color: RainbowColor | null
      thread: Thread | null
      group: string | null
      groupId: string | null
      index: number | null
      marker: {
        type: MarkerType
        provider: string | null
        name: string | null
        src: string | null
        unified: string | null
      } | null
      community: { slug: string | null } | null
    } | null> | null
  } | null
}

export type DashboardUpdateCommunityTagGroupMutationVariables = Exact<{
  id: string | number
  title: string
  community: string
  thread?: Thread | null | undefined
}>

export type DashboardUpdateCommunityTagGroupMutation = {
  updateCommunityTagGroup: {
    id: string | null
    title: string | null
    index: number | null
    tags: Array<{
      id: string | null
      title: string | null
      layout: string | null
      desc: string | null
      slug: string | null
      color: RainbowColor | null
      thread: Thread | null
      group: string | null
      groupId: string | null
      index: number | null
      marker: {
        type: MarkerType
        provider: string | null
        name: string | null
        src: string | null
        unified: string | null
      } | null
      community: { slug: string | null } | null
    } | null> | null
  } | null
}

export type DashboardCreateCommunityTagMutationVariables = Exact<{
  thread: Thread
  title: string
  slug: string
  layout?: string | null | undefined
  color: RainbowColor
  groupId: string | number
  community: string
  marker?: MarkerInput | null | undefined
}>

export type DashboardCreateCommunityTagMutation = {
  createCommunityTag: { id: string | null } | null
}

export type DashboardReindexTagsInGroupMutationVariables = Exact<{
  community: string
  thread?: Thread | null | undefined
  groupId: string | number
  tags?: Array<ReindexTagInput | null | undefined> | ReindexTagInput | null | undefined
}>

export type DashboardReindexTagsInGroupMutation = {
  reindexTagsInGroup: { done: boolean | null } | null
}

export type DashboardReindexCommunityTagsMutationVariables = Exact<{
  community: string
  thread?: Thread | null | undefined
  tags?:
    | Array<ReindexCommunityTagInput | null | undefined>
    | ReindexCommunityTagInput
    | null
    | undefined
}>

export type DashboardReindexCommunityTagsMutation = {
  reindexCommunityTags: { done: boolean | null } | null
}

export type DashboardReindexCommunityTagGroupsMutationVariables = Exact<{
  community: string
  thread?: Thread | null | undefined
  groups?:
    | Array<ReindexCommunityTagGroupInput | null | undefined>
    | ReindexCommunityTagGroupInput
    | null
    | undefined
}>

export type DashboardReindexCommunityTagGroupsMutation = {
  reindexCommunityTagGroups: { done: boolean | null } | null
}

export type DocCoverMarkerFieldsFragment = {
  type: MarkerType
  provider: string | null
  name: string | null
  src: string | null
  unified: string | null
  appearance: {
    light: { color: string | null; bg: string | null }
    dark: { color: string | null; bg: string | null }
  } | null
}

export type DocCoverItemFieldsFragment = {
  id: string
  nodeId: string
  docId: string | null
  index: number
  type: DocTreeNodeType
  title: string
  href: string
  badge: string | null
  leafCount: number | null
  marker: {
    type: MarkerType
    provider: string | null
    name: string | null
    src: string | null
    unified: string | null
    appearance: {
      light: { color: string | null; bg: string | null }
      dark: { color: string | null; bg: string | null }
    } | null
  } | null
}

export type DocCoverQueryVariables = Exact<{
  community: string
  view?: DocCoverView | null | undefined
}>

export type DocCoverQuery = {
  docCover: {
    cards: Array<{
      id: string
      groupNodeId: string
      index: number
      appearance: unknown
      title: string
      items: Array<{
        id: string
        nodeId: string
        docId: string | null
        index: number
        type: DocTreeNodeType
        title: string
        href: string
        badge: string | null
        leafCount: number | null
        marker: {
          type: MarkerType
          provider: string | null
          name: string | null
          src: string | null
          unified: string | null
          appearance: {
            light: { color: string | null; bg: string | null }
            dark: { color: string | null; bg: string | null }
          } | null
        } | null
      }>
    }>
    pinnedDocs: Array<{
      nodeId: string
      index: number
      appearance: unknown
      href: string
      doc: {
        title: string | null
        author: { avatar: string | null; nickname: string | null } | null
        document: { thumbnail: unknown } | null
      }
    }>
  } | null
}

export type KanbanAuthorFieldsFragment = {
  login: string | null
  nickname: string | null
  avatar: string | null
  bio: string | null
  shortbio: string | null
}

export type KanbanPageFieldsFragment = {
  totalPages: number | null
  totalCount: number | null
  pageSize: number | null
  pageNumber: number | null
}

export type GroupedKanbanPostsQueryVariables = Exact<{
  community: string
}>

export type GroupedKanbanPostsQuery = {
  groupedKanbanPosts: {
    backlog: {
      totalPages: number | null
      totalCount: number | null
      pageSize: number | null
      pageNumber: number | null
      entries: Array<{
        innerId: string | null
        cat: ArticleCatEnum | null
        status: ArticleStatusEnum | null
        title: string | null
        community: { slug: string | null } | null
        meta: { thread: Thread | null } | null
        author: {
          login: string | null
          nickname: string | null
          avatar: string | null
          bio: string | null
          shortbio: string | null
        } | null
      } | null> | null
    } | null
    todo: {
      totalPages: number | null
      totalCount: number | null
      pageSize: number | null
      pageNumber: number | null
      entries: Array<{
        innerId: string | null
        cat: ArticleCatEnum | null
        status: ArticleStatusEnum | null
        title: string | null
        community: { slug: string | null } | null
        meta: { thread: Thread | null } | null
        author: {
          login: string | null
          nickname: string | null
          avatar: string | null
          bio: string | null
          shortbio: string | null
        } | null
      } | null> | null
    } | null
    wip: {
      totalPages: number | null
      totalCount: number | null
      pageSize: number | null
      pageNumber: number | null
      entries: Array<{
        innerId: string | null
        cat: ArticleCatEnum | null
        status: ArticleStatusEnum | null
        title: string | null
        community: { slug: string | null } | null
        meta: { thread: Thread | null } | null
        author: {
          login: string | null
          nickname: string | null
          avatar: string | null
          bio: string | null
          shortbio: string | null
        } | null
      } | null> | null
    } | null
    done: {
      totalPages: number | null
      totalCount: number | null
      pageSize: number | null
      pageNumber: number | null
      entries: Array<{
        innerId: string | null
        cat: ArticleCatEnum | null
        status: ArticleStatusEnum | null
        title: string | null
        community: { slug: string | null } | null
        meta: { thread: Thread | null } | null
        author: {
          login: string | null
          nickname: string | null
          avatar: string | null
          bio: string | null
          shortbio: string | null
        } | null
      } | null> | null
    } | null
    rejected: {
      totalPages: number | null
      totalCount: number | null
      pageSize: number | null
      pageNumber: number | null
      entries: Array<{
        innerId: string | null
        cat: ArticleCatEnum | null
        status: ArticleStatusEnum | null
        title: string | null
        community: { slug: string | null } | null
        meta: { thread: Thread | null } | null
        author: {
          login: string | null
          nickname: string | null
          avatar: string | null
          bio: string | null
          shortbio: string | null
        } | null
      } | null> | null
    } | null
  } | null
}

export type UserPassportQueryVariables = Exact<{
  login: string
}>

export type UserPassportQuery = {
  user: {
    passportString: string | null
    social: { github: string | null; twitter: string | null; zhihu: string | null } | null
  } | null
}

export type AllPassportRulesQueryVariables = Exact<{ [key: string]: never }>

export type AllPassportRulesQuery = { allPassportRulesString: { cms: unknown } | null }

export type UpdateModeratorPassportMutationVariables = Exact<{
  community: string
  user: string
  rules: unknown
}>

export type UpdateModeratorPassportMutation = {
  updateModeratorPassport: {
    slug: string | null
    moderators: Array<{
      isRoot: boolean | null
      passportItemCount: number | null
      user: {
        login: string | null
        avatar: string | null
        nickname: string | null
        bio: string | null
      } | null
    } | null> | null
  } | null
}

export type RemoveModeratorMutationVariables = Exact<{
  community: string
  user: string
}>

export type RemoveModeratorMutation = {
  removeModerator: {
    slug: string | null
    moderators: Array<{
      isRoot: boolean | null
      passportItemCount: number | null
      user: {
        login: string | null
        avatar: string | null
        nickname: string | null
        bio: string | null
      } | null
    } | null> | null
  } | null
}

export type PostThreadFreshQueryVariables = Exact<{
  article: ArticlePathInput
  userHasLogin: boolean
}>

export type PostThreadFreshQuery = {
  post: {
    innerId: string | null
    views: number | null
    upvotesCount: number | null
    commentsCount: number | null
    viewerHasViewed?: boolean | null
    viewerHasUpvoted?: boolean | null
  }
}

export type RichEditorSimpleQueryQueryVariables = Exact<{
  article: ArticlePathInput
}>

export type RichEditorSimpleQueryQuery = { post: { innerId: string | null } }

export type DeleteCommunityTagMutationVariables = Exact<{
  id: string | number
  community: string
  thread?: Thread | null | undefined
}>

export type DeleteCommunityTagMutation = { deleteCommunityTag: { id: string | null } | null }

export type CreateCommunityTagMutationVariables = Exact<{
  thread: Thread
  title: string
  slug: string
  layout?: string | null | undefined
  color: RainbowColor
  groupId: string | number
  community: string
  marker?: MarkerInput | null | undefined
}>

export type CreateCommunityTagMutation = { createCommunityTag: { id: string | null } | null }

export type UpdateCommunityTagMutationVariables = Exact<{
  id: string | number
  color?: RainbowColor | null | undefined
  title?: string | null | undefined
  layout?: string | null | undefined
  desc?: string | null | undefined
  slug?: string | null | undefined
  community: string
  groupId?: string | number | null | undefined
  marker?: MarkerInput | null | undefined
}>

export type UpdateCommunityTagMutation = { updateCommunityTag: { id: string | null } | null }

export const PageAuthorFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageAuthorFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'User' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PageAuthorFieldsFragment, unknown>
export const PageCommunityFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageCommunityFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Community' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
          { kind: 'Field', name: { kind: 'Name', value: 'logo' } },
          { kind: 'Field', name: { kind: 'Name', value: 'subscribersCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'homepage' } },
          { kind: 'Field', name: { kind: 'Name', value: 'articlesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'views' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pending' } },
          { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PageCommunityFieldsFragment, unknown>
export const PageTagFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageTagFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommunityTag' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'layout' } },
          { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
          { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
          { kind: 'Field', name: { kind: 'Name', value: 'color' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
          { kind: 'Field', name: { kind: 'Name', value: 'group' } },
          { kind: 'Field', name: { kind: 'Name', value: 'groupId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'slug' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PageTagFieldsFragment, unknown>
export const PagePostFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PagePostFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Post' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isPinned' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'activeAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'views' } },
          { kind: 'Field', name: { kind: 'Name', value: 'commentsCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'upvotesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'commentsParticipantsCount' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'author' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageAuthorFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageCommunityFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'communities' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageCommunityFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'communityTags' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageTagFields' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageAuthorFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'User' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageCommunityFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Community' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
          { kind: 'Field', name: { kind: 'Name', value: 'logo' } },
          { kind: 'Field', name: { kind: 'Name', value: 'subscribersCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'homepage' } },
          { kind: 'Field', name: { kind: 'Name', value: 'articlesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'views' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pending' } },
          { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageTagFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommunityTag' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'layout' } },
          { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
          { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
          { kind: 'Field', name: { kind: 'Name', value: 'color' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
          { kind: 'Field', name: { kind: 'Name', value: 'group' } },
          { kind: 'Field', name: { kind: 'Name', value: 'groupId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'slug' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PagePostFieldsFragment, unknown>
export const PageCommonUserFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageCommonUserFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommonUser' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PageCommonUserFieldsFragment, unknown>
export const PagePostDetailFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PagePostDetailFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Post' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'meta' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
                { kind: 'Field', name: { kind: 'Name', value: 'isEdited' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'latestUpvotedUsers' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'PageCommonUserFields' },
                      },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'document' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'json' } },
                { kind: 'Field', name: { kind: 'Name', value: 'html' } },
                { kind: 'Field', name: { kind: 'Name', value: 'markdown' } },
                { kind: 'Field', name: { kind: 'Name', value: 'markdownToc' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'commentsParticipants' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageAuthorFields' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'collectsCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'archivedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isArchived' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'viewerHasCollected' },
            directives: [
              {
                kind: 'Directive',
                name: { kind: 'Name', value: 'include' },
                arguments: [
                  {
                    kind: 'Argument',
                    name: { kind: 'Name', value: 'if' },
                    value: { kind: 'Variable', name: { kind: 'Name', value: 'userHasLogin' } },
                  },
                ],
              },
            ],
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'viewerHasUpvoted' },
            directives: [
              {
                kind: 'Directive',
                name: { kind: 'Name', value: 'include' },
                arguments: [
                  {
                    kind: 'Argument',
                    name: { kind: 'Name', value: 'if' },
                    value: { kind: 'Variable', name: { kind: 'Name', value: 'userHasLogin' } },
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageCommonUserFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommonUser' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageAuthorFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'User' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PagePostDetailFieldsFragment, unknown>
export const PageChangelogFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageChangelogFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Changelog' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isPinned' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'activeAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'views' } },
          { kind: 'Field', name: { kind: 'Name', value: 'commentsCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'upvotesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'commentsParticipantsCount' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'author' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageAuthorFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageCommunityFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'communities' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageCommunityFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'communityTags' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageTagFields' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageAuthorFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'User' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageCommunityFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Community' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
          { kind: 'Field', name: { kind: 'Name', value: 'logo' } },
          { kind: 'Field', name: { kind: 'Name', value: 'subscribersCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'homepage' } },
          { kind: 'Field', name: { kind: 'Name', value: 'articlesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'views' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pending' } },
          { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageTagFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommunityTag' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'layout' } },
          { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
          { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
          { kind: 'Field', name: { kind: 'Name', value: 'color' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
          { kind: 'Field', name: { kind: 'Name', value: 'group' } },
          { kind: 'Field', name: { kind: 'Name', value: 'groupId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'slug' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PageChangelogFieldsFragment, unknown>
export const PageChangelogDetailFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageChangelogDetailFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Changelog' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'meta' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
                { kind: 'Field', name: { kind: 'Name', value: 'isEdited' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'latestUpvotedUsers' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'PageCommonUserFields' },
                      },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'document' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'json' } },
                { kind: 'Field', name: { kind: 'Name', value: 'html' } },
                { kind: 'Field', name: { kind: 'Name', value: 'markdown' } },
                { kind: 'Field', name: { kind: 'Name', value: 'markdownToc' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'commentsParticipants' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageAuthorFields' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'collectsCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'archivedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isArchived' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'viewerHasCollected' },
            directives: [
              {
                kind: 'Directive',
                name: { kind: 'Name', value: 'include' },
                arguments: [
                  {
                    kind: 'Argument',
                    name: { kind: 'Name', value: 'if' },
                    value: { kind: 'Variable', name: { kind: 'Name', value: 'userHasLogin' } },
                  },
                ],
              },
            ],
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'viewerHasUpvoted' },
            directives: [
              {
                kind: 'Directive',
                name: { kind: 'Name', value: 'include' },
                arguments: [
                  {
                    kind: 'Argument',
                    name: { kind: 'Name', value: 'if' },
                    value: { kind: 'Variable', name: { kind: 'Name', value: 'userHasLogin' } },
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageCommonUserFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommonUser' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageAuthorFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'User' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PageChangelogDetailFieldsFragment, unknown>
export const PagePostPageInfoFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PagePostPageInfo' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'PagedPosts' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'totalPages' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageSize' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageNumber' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PagePostPageInfoFragment, unknown>
export const PageChangelogPageInfoFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageChangelogPageInfo' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'PagedChangelogs' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'totalPages' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageSize' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageNumber' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PageChangelogPageInfoFragment, unknown>
export const PageDocFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageDocFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Doc' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isPinned' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'activeAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'views' } },
          { kind: 'Field', name: { kind: 'Name', value: 'commentsCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'upvotesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'commentsParticipantsCount' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'author' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageAuthorFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageCommunityFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'communities' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageCommunityFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'communityTags' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageTagFields' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageAuthorFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'User' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageCommunityFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Community' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
          { kind: 'Field', name: { kind: 'Name', value: 'logo' } },
          { kind: 'Field', name: { kind: 'Name', value: 'subscribersCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'homepage' } },
          { kind: 'Field', name: { kind: 'Name', value: 'articlesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'views' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pending' } },
          { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageTagFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommunityTag' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'layout' } },
          { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
          { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
          { kind: 'Field', name: { kind: 'Name', value: 'color' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
          { kind: 'Field', name: { kind: 'Name', value: 'group' } },
          { kind: 'Field', name: { kind: 'Name', value: 'groupId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'slug' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PageDocFieldsFragment, unknown>
export const PageDocDetailFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageDocDetailFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Doc' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'meta' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
                { kind: 'Field', name: { kind: 'Name', value: 'isEdited' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'latestUpvotedUsers' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'PageCommonUserFields' },
                      },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'document' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'json' } },
                { kind: 'Field', name: { kind: 'Name', value: 'html' } },
                { kind: 'Field', name: { kind: 'Name', value: 'markdown' } },
                { kind: 'Field', name: { kind: 'Name', value: 'markdownToc' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'commentsParticipants' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageAuthorFields' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'collectsCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'archivedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isArchived' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'viewerHasCollected' },
            directives: [
              {
                kind: 'Directive',
                name: { kind: 'Name', value: 'include' },
                arguments: [
                  {
                    kind: 'Argument',
                    name: { kind: 'Name', value: 'if' },
                    value: { kind: 'Variable', name: { kind: 'Name', value: 'userHasLogin' } },
                  },
                ],
              },
            ],
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'viewerHasUpvoted' },
            directives: [
              {
                kind: 'Directive',
                name: { kind: 'Name', value: 'include' },
                arguments: [
                  {
                    kind: 'Argument',
                    name: { kind: 'Name', value: 'if' },
                    value: { kind: 'Variable', name: { kind: 'Name', value: 'userHasLogin' } },
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageCommonUserFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommonUser' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageAuthorFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'User' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PageDocDetailFieldsFragment, unknown>
export const PageDocPageInfoFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageDocPageInfo' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'PagedDocs' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'totalPages' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageSize' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageNumber' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PageDocPageInfoFragment, unknown>
export const PageCommunityPageInfoFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageCommunityPageInfo' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'PagedCommunities' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'totalPages' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageSize' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageNumber' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PageCommunityPageInfoFragment, unknown>
export const PageDocPublicTreeNodeFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageDocPublicTreeNodeFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DocPublicTreeNode' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'parentNodeId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'docId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'type' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          { kind: 'Field', name: { kind: 'Name', value: 'href' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'appearance' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'light' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bg' } },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'dark' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bg' } },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'badge' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PageDocPublicTreeNodeFieldsFragment, unknown>
export const PageDocPublicTreeChildFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageDocPublicTreeChildFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DocPublicTreeNode' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageDocPublicTreeNodeFields' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pages' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'PageDocPublicTreeNodeFields' },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageDocPublicTreeNodeFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DocPublicTreeNode' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'parentNodeId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'docId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'type' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          { kind: 'Field', name: { kind: 'Name', value: 'href' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'appearance' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'light' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bg' } },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'dark' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bg' } },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'badge' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PageDocPublicTreeChildFieldsFragment, unknown>
export const PageDocPublicTreeGroupFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageDocPublicTreeGroupFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DocPublicTreeNode' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageDocPublicTreeNodeFields' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pages' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'PageDocPublicTreeChildFields' },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageDocPublicTreeNodeFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DocPublicTreeNode' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'parentNodeId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'docId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'type' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          { kind: 'Field', name: { kind: 'Name', value: 'href' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'appearance' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'light' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bg' } },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'dark' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bg' } },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'badge' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageDocPublicTreeChildFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DocPublicTreeNode' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageDocPublicTreeNodeFields' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pages' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'PageDocPublicTreeNodeFields' },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PageDocPublicTreeGroupFieldsFragment, unknown>
export const PageCategoryPageInfoFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageCategoryPageInfo' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'PagedCategories' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'totalPages' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageSize' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageNumber' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PageCategoryPageInfoFragment, unknown>
export const UserAuthorFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'UserAuthorFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'User' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<UserAuthorFieldsFragment, unknown>
export const UserSocialFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'UserSocialFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'SocialMap' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'github' } },
          { kind: 'Field', name: { kind: 'Name', value: 'twitter' } },
          { kind: 'Field', name: { kind: 'Name', value: 'company' } },
          { kind: 'Field', name: { kind: 'Name', value: 'blog' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<UserSocialFieldsFragment, unknown>
export const UserAchievementFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'UserAchievementFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Achievement' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'reputation' } },
          { kind: 'Field', name: { kind: 'Name', value: 'articlesUpvotesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'articlesCollectsCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'donateMember' } },
          { kind: 'Field', name: { kind: 'Name', value: 'seniorMember' } },
          { kind: 'Field', name: { kind: 'Name', value: 'sponsorMember' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<UserAchievementFieldsFragment, unknown>
export const ArticleEditorAuthorFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ArticleEditorAuthorFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'User' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<ArticleEditorAuthorFieldsFragment, unknown>
export const ArticleEditorCommunityFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ArticleEditorCommunityFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Community' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
          { kind: 'Field', name: { kind: 'Name', value: 'logo' } },
          { kind: 'Field', name: { kind: 'Name', value: 'subscribersCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'homepage' } },
          { kind: 'Field', name: { kind: 'Name', value: 'articlesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'views' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pending' } },
          { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<ArticleEditorCommunityFieldsFragment, unknown>
export const ArticleEditorTagFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ArticleEditorTagFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommunityTag' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'layout' } },
          { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
          { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
          { kind: 'Field', name: { kind: 'Name', value: 'color' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
          { kind: 'Field', name: { kind: 'Name', value: 'group' } },
          { kind: 'Field', name: { kind: 'Name', value: 'groupId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'slug' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<ArticleEditorTagFieldsFragment, unknown>
export const ArticleMenuTagFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ArticleMenuTagFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommunityTag' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'layout' } },
          { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
          { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
          { kind: 'Field', name: { kind: 'Name', value: 'color' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
          { kind: 'Field', name: { kind: 'Name', value: 'group' } },
          { kind: 'Field', name: { kind: 'Name', value: 'groupId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'slug' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<ArticleMenuTagFieldsFragment, unknown>
export const CommentAuthorFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'CommentAuthorFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'User' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CommentAuthorFieldsFragment, unknown>
export const CommentMetaFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'CommentMetaFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommentMeta' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'isLegal' } },
          { kind: 'Field', name: { kind: 'Name', value: 'illegalReason' } },
          { kind: 'Field', name: { kind: 'Name', value: 'illegalWords' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isArticleAuthorUpvoted' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isReplyToOthers' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CommentMetaFieldsFragment, unknown>
export const CommentEmotionFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'CommentEmotionFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'EmotionStat' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'type' } },
          { kind: 'Field', name: { kind: 'Name', value: 'count' } },
          { kind: 'Field', name: { kind: 'Name', value: 'viewerHasReacted' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'latestUsers' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'login' } },
                { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
                { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CommentEmotionFieldsFragment, unknown>
export const CommentFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'CommentFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Comment' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bodyHtml' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'author' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'CommentAuthorFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'meta' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'CommentMetaFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'emotions' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'CommentEmotionFields' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'isPinned' } },
          { kind: 'Field', name: { kind: 'Name', value: 'floor' } },
          { kind: 'Field', name: { kind: 'Name', value: 'upvotesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isArticleAuthor' } },
          { kind: 'Field', name: { kind: 'Name', value: 'viewerHasUpvoted' } },
          { kind: 'Field', name: { kind: 'Name', value: 'viewerHasReported' } },
          { kind: 'Field', name: { kind: 'Name', value: 'repliesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'CommentAuthorFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'User' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'CommentMetaFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommentMeta' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'isLegal' } },
          { kind: 'Field', name: { kind: 'Name', value: 'illegalReason' } },
          { kind: 'Field', name: { kind: 'Name', value: 'illegalWords' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isArticleAuthorUpvoted' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isReplyToOthers' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'CommentEmotionFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'EmotionStat' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'type' } },
          { kind: 'Field', name: { kind: 'Name', value: 'count' } },
          { kind: 'Field', name: { kind: 'Name', value: 'viewerHasReacted' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'latestUsers' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'login' } },
                { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
                { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CommentFieldsFragment, unknown>
export const CommentReplyFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'CommentReplyFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommentReply' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bodyHtml' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'author' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'CommentAuthorFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'meta' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'CommentMetaFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'emotions' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'CommentEmotionFields' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'isPinned' } },
          { kind: 'Field', name: { kind: 'Name', value: 'floor' } },
          { kind: 'Field', name: { kind: 'Name', value: 'upvotesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isArticleAuthor' } },
          { kind: 'Field', name: { kind: 'Name', value: 'viewerHasUpvoted' } },
          { kind: 'Field', name: { kind: 'Name', value: 'viewerHasReported' } },
          { kind: 'Field', name: { kind: 'Name', value: 'repliesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'replyToComment' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'CommentFields' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'CommentAuthorFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'User' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'CommentMetaFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommentMeta' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'isLegal' } },
          { kind: 'Field', name: { kind: 'Name', value: 'illegalReason' } },
          { kind: 'Field', name: { kind: 'Name', value: 'illegalWords' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isArticleAuthorUpvoted' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isReplyToOthers' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'CommentEmotionFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'EmotionStat' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'type' } },
          { kind: 'Field', name: { kind: 'Name', value: 'count' } },
          { kind: 'Field', name: { kind: 'Name', value: 'viewerHasReacted' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'latestUsers' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'login' } },
                { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
                { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'CommentFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Comment' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bodyHtml' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'author' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'CommentAuthorFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'meta' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'CommentMetaFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'emotions' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'CommentEmotionFields' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'isPinned' } },
          { kind: 'Field', name: { kind: 'Name', value: 'floor' } },
          { kind: 'Field', name: { kind: 'Name', value: 'upvotesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isArticleAuthor' } },
          { kind: 'Field', name: { kind: 'Name', value: 'viewerHasUpvoted' } },
          { kind: 'Field', name: { kind: 'Name', value: 'viewerHasReported' } },
          { kind: 'Field', name: { kind: 'Name', value: 'repliesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CommentReplyFieldsFragment, unknown>
export const CommentPageFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'CommentPageFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'PagedComments' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'totalPages' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageSize' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageNumber' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CommentPageFieldsFragment, unknown>
export const DashboardWallpaperFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardWallpaperFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DsbWallpaper' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'light' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'source' } },
                { kind: 'Field', name: { kind: 'Name', value: 'gradient' } },
                { kind: 'Field', name: { kind: 'Name', value: 'pattern' } },
                { kind: 'Field', name: { kind: 'Name', value: 'contentShadow' } },
                { kind: 'Field', name: { kind: 'Name', value: 'effect' } },
                { kind: 'Field', name: { kind: 'Name', value: 'texture' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'dark' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'source' } },
                { kind: 'Field', name: { kind: 'Name', value: 'gradient' } },
                { kind: 'Field', name: { kind: 'Name', value: 'pattern' } },
                { kind: 'Field', name: { kind: 'Name', value: 'contentShadow' } },
                { kind: 'Field', name: { kind: 'Name', value: 'effect' } },
                { kind: 'Field', name: { kind: 'Name', value: 'texture' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DashboardWallpaperFieldsFragment, unknown>
export const ContentImportJobFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ContentImportJobFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'ContentImportJob' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'status' } },
          { kind: 'Field', name: { kind: 'Name', value: 'progress' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'process' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'state' } },
                { kind: 'Field', name: { kind: 'Name', value: 'stage' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'progress' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'completed' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'total' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'unit' } },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'recentBatch' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'ref' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'label' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'state' } },
                    ],
                  },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'errorCode' } },
          { kind: 'Field', name: { kind: 'Name', value: 'errorMessage' } },
          { kind: 'Field', name: { kind: 'Name', value: 'failedItems' } },
          { kind: 'Field', name: { kind: 'Name', value: 'skipped' } },
          { kind: 'Field', name: { kind: 'Name', value: 'targetBranch' } },
          { kind: 'Field', name: { kind: 'Name', value: 'firstImportedDocRef' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'sourceInfo' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'repo' } },
                { kind: 'Field', name: { kind: 'Name', value: 'repoUrl' } },
                { kind: 'Field', name: { kind: 'Name', value: 'branch' } },
                { kind: 'Field', name: { kind: 'Name', value: 'commit' } },
                { kind: 'Field', name: { kind: 'Name', value: 'framework' } },
                { kind: 'Field', name: { kind: 'Name', value: 'contentRoot' } },
                { kind: 'Field', name: { kind: 'Name', value: 'configPaths' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'counts' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'tabs' } },
                { kind: 'Field', name: { kind: 'Name', value: 'groups' } },
                { kind: 'Field', name: { kind: 'Name', value: 'pages' } },
                { kind: 'Field', name: { kind: 'Name', value: 'links' } },
                { kind: 'Field', name: { kind: 'Name', value: 'assets' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'tree' } },
          { kind: 'Field', name: { kind: 'Name', value: 'badSmells' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<ContentImportJobFieldsFragment, unknown>
export const DashboardDocTreeNodeFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardDocTreeNodeFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DocTreeNode' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'parentNodeId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'docId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'type' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          { kind: 'Field', name: { kind: 'Name', value: 'href' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'appearance' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'light' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bg' } },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'dark' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bg' } },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'badge' } },
          { kind: 'Field', name: { kind: 'Name', value: 'hidden' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'publishState' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                { kind: 'Field', name: { kind: 'Name', value: 'published' } },
                { kind: 'Field', name: { kind: 'Name', value: 'publishedBefore' } },
                { kind: 'Field', name: { kind: 'Name', value: 'hasDraft' } },
                { kind: 'Field', name: { kind: 'Name', value: 'publicNodeId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'publicDocId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'hasUnpublishedChanges' } },
                { kind: 'Field', name: { kind: 'Name', value: 'lastPublishedAt' } },
                { kind: 'Field', name: { kind: 'Name', value: 'inCover' } },
                { kind: 'Field', name: { kind: 'Name', value: 'hiddenFromCover' } },
                { kind: 'Field', name: { kind: 'Name', value: 'pinnedToCover' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DashboardDocTreeNodeFieldsFragment, unknown>
export const DashboardDocTreeChildFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardDocTreeChildFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DocTreeNode' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'FragmentSpread', name: { kind: 'Name', value: 'DashboardDocTreeNodeFields' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pages' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'DashboardDocTreeNodeFields' },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardDocTreeNodeFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DocTreeNode' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'parentNodeId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'docId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'type' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          { kind: 'Field', name: { kind: 'Name', value: 'href' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'appearance' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'light' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bg' } },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'dark' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bg' } },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'badge' } },
          { kind: 'Field', name: { kind: 'Name', value: 'hidden' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'publishState' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                { kind: 'Field', name: { kind: 'Name', value: 'published' } },
                { kind: 'Field', name: { kind: 'Name', value: 'publishedBefore' } },
                { kind: 'Field', name: { kind: 'Name', value: 'hasDraft' } },
                { kind: 'Field', name: { kind: 'Name', value: 'publicNodeId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'publicDocId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'hasUnpublishedChanges' } },
                { kind: 'Field', name: { kind: 'Name', value: 'lastPublishedAt' } },
                { kind: 'Field', name: { kind: 'Name', value: 'inCover' } },
                { kind: 'Field', name: { kind: 'Name', value: 'hiddenFromCover' } },
                { kind: 'Field', name: { kind: 'Name', value: 'pinnedToCover' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DashboardDocTreeChildFieldsFragment, unknown>
export const DashboardDocTreeGroupFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardDocTreeGroupFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DocTreeNode' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'FragmentSpread', name: { kind: 'Name', value: 'DashboardDocTreeNodeFields' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pages' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'DashboardDocTreeChildFields' },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardDocTreeNodeFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DocTreeNode' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'parentNodeId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'docId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'type' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          { kind: 'Field', name: { kind: 'Name', value: 'href' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'appearance' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'light' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bg' } },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'dark' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bg' } },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'badge' } },
          { kind: 'Field', name: { kind: 'Name', value: 'hidden' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'publishState' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                { kind: 'Field', name: { kind: 'Name', value: 'published' } },
                { kind: 'Field', name: { kind: 'Name', value: 'publishedBefore' } },
                { kind: 'Field', name: { kind: 'Name', value: 'hasDraft' } },
                { kind: 'Field', name: { kind: 'Name', value: 'publicNodeId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'publicDocId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'hasUnpublishedChanges' } },
                { kind: 'Field', name: { kind: 'Name', value: 'lastPublishedAt' } },
                { kind: 'Field', name: { kind: 'Name', value: 'inCover' } },
                { kind: 'Field', name: { kind: 'Name', value: 'hiddenFromCover' } },
                { kind: 'Field', name: { kind: 'Name', value: 'pinnedToCover' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardDocTreeChildFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DocTreeNode' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'FragmentSpread', name: { kind: 'Name', value: 'DashboardDocTreeNodeFields' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pages' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'DashboardDocTreeNodeFields' },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DashboardDocTreeGroupFieldsFragment, unknown>
export const DashboardDocPublishChecklistItemFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardDocPublishChecklistItemFields' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'DocPublishChecklistItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'action' } },
          { kind: 'Field', name: { kind: 'Name', value: 'selectedByDefault' } },
          { kind: 'Field', name: { kind: 'Name', value: 'selectable' } },
          { kind: 'Field', name: { kind: 'Name', value: 'disabledReason' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DashboardDocPublishChecklistItemFieldsFragment, unknown>
export const DashboardDocTreeMutationPayloadFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardDocTreeMutationPayload' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DocTreeMutationPayload' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'revision' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'treeState' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'hasUnpublishedChanges' } },
                { kind: 'Field', name: { kind: 'Name', value: 'stagedEventCount' } },
                { kind: 'Field', name: { kind: 'Name', value: 'baseSnapshotId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'latestSnapshotId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'latestReleaseId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'latestReleaseNumber' } },
                { kind: 'Field', name: { kind: 'Name', value: 'revision' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'conflict' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'node' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'DashboardDocTreeNodeFields' },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'affectedNodes' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'DashboardDocTreeNodeFields' },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardDocTreeNodeFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DocTreeNode' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'parentNodeId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'docId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'type' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          { kind: 'Field', name: { kind: 'Name', value: 'href' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'appearance' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'light' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bg' } },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'dark' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bg' } },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'badge' } },
          { kind: 'Field', name: { kind: 'Name', value: 'hidden' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'publishState' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                { kind: 'Field', name: { kind: 'Name', value: 'published' } },
                { kind: 'Field', name: { kind: 'Name', value: 'publishedBefore' } },
                { kind: 'Field', name: { kind: 'Name', value: 'hasDraft' } },
                { kind: 'Field', name: { kind: 'Name', value: 'publicNodeId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'publicDocId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'hasUnpublishedChanges' } },
                { kind: 'Field', name: { kind: 'Name', value: 'lastPublishedAt' } },
                { kind: 'Field', name: { kind: 'Name', value: 'inCover' } },
                { kind: 'Field', name: { kind: 'Name', value: 'hiddenFromCover' } },
                { kind: 'Field', name: { kind: 'Name', value: 'pinnedToCover' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DashboardDocTreeMutationPayloadFragment, unknown>
export const DashboardAuthorFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardAuthorFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'User' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DashboardAuthorFieldsFragment, unknown>
export const DashboardTagFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardTagFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommunityTag' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'layout' } },
          { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
          { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
          { kind: 'Field', name: { kind: 'Name', value: 'color' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
          { kind: 'Field', name: { kind: 'Name', value: 'group' } },
          { kind: 'Field', name: { kind: 'Name', value: 'groupId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'slug' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DashboardTagFieldsFragment, unknown>
export const DashboardThirdPartyAnalyticsFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardThirdPartyAnalyticsFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DsbThirdPartyAnalytics' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
          { kind: 'Field', name: { kind: 'Name', value: 'enabled' } },
          { kind: 'Field', name: { kind: 'Name', value: 'measurementId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'containerId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'projectId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'domain' } },
          { kind: 'Field', name: { kind: 'Name', value: 'siteId' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DashboardThirdPartyAnalyticsFieldsFragment, unknown>
export const DashboardHeaderLinkFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardHeaderLinkFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DsbLink' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'type' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'url' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'links' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                { kind: 'Field', name: { kind: 'Name', value: 'url' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DashboardHeaderLinkFieldsFragment, unknown>
export const DashboardFooterOnelineLinkFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardFooterOnelineLinkFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DsbLinkChild' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'url' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DashboardFooterOnelineLinkFieldsFragment, unknown>
export const DashboardTrashedArticlesPageInfoFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardTrashedArticlesPageInfo' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'PagedTrashedArticles' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageSize' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalPages' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageNumber' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DashboardTrashedArticlesPageInfoFragment, unknown>
export const DocCoverMarkerFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DocCoverMarkerFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Marker' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'type' } },
          { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
          { kind: 'Field', name: { kind: 'Name', value: 'src' } },
          { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'appearance' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'light' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'bg' } },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'dark' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'bg' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DocCoverMarkerFieldsFragment, unknown>
export const DocCoverItemFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DocCoverItemFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DocCoverCardItem' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nodeId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'docId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          { kind: 'Field', name: { kind: 'Name', value: 'type' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'href' } },
          { kind: 'Field', name: { kind: 'Name', value: 'badge' } },
          { kind: 'Field', name: { kind: 'Name', value: 'leafCount' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'DocCoverMarkerFields' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DocCoverMarkerFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Marker' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'type' } },
          { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
          { kind: 'Field', name: { kind: 'Name', value: 'src' } },
          { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'appearance' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'light' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'bg' } },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'dark' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'bg' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DocCoverItemFieldsFragment, unknown>
export const KanbanAuthorFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'KanbanAuthorFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'User' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<KanbanAuthorFieldsFragment, unknown>
export const KanbanPageFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'KanbanPageFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'PagedPosts' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'totalPages' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageSize' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageNumber' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<KanbanPageFieldsFragment, unknown>
export const SetCommunityTagDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'SetCommunityTag' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ArticlePathInput' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'tagId' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'setCommunityTag' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'article' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'communityTagId' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'tagId' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'title' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<SetCommunityTagMutation, SetCommunityTagMutationVariables>
export const UnsetCommunityTagDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UnsetCommunityTag' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ArticlePathInput' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'tagId' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'unsetCommunityTag' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'article' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'communityTagId' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'tagId' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'title' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<UnsetCommunityTagMutation, UnsetCommunityTagMutationVariables>
export const FollowDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'Follow' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'login' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'follow' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'login' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'login' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'login' } },
                { kind: 'Field', name: { kind: 'Name', value: 'viewerHasFollowed' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<FollowMutation, FollowMutationVariables>
export const UndoFollowDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UndoFollow' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'login' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'undoFollow' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'login' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'login' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'login' } },
                { kind: 'Field', name: { kind: 'Name', value: 'viewerHasFollowed' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<UndoFollowMutation, UndoFollowMutationVariables>
export const ChangelogDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'Changelog' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ArticlePathInput' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'userHasLogin' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Boolean' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'changelog' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'article' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageChangelogFields' } },
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'PageChangelogDetailFields' },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageAuthorFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'User' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageCommunityFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Community' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
          { kind: 'Field', name: { kind: 'Name', value: 'logo' } },
          { kind: 'Field', name: { kind: 'Name', value: 'subscribersCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'homepage' } },
          { kind: 'Field', name: { kind: 'Name', value: 'articlesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'views' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pending' } },
          { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageTagFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommunityTag' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'layout' } },
          { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
          { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
          { kind: 'Field', name: { kind: 'Name', value: 'color' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
          { kind: 'Field', name: { kind: 'Name', value: 'group' } },
          { kind: 'Field', name: { kind: 'Name', value: 'groupId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'slug' } }],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageCommonUserFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommonUser' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageChangelogFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Changelog' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isPinned' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'activeAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'views' } },
          { kind: 'Field', name: { kind: 'Name', value: 'commentsCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'upvotesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'commentsParticipantsCount' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'author' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageAuthorFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageCommunityFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'communities' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageCommunityFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'communityTags' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageTagFields' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageChangelogDetailFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Changelog' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'meta' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
                { kind: 'Field', name: { kind: 'Name', value: 'isEdited' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'latestUpvotedUsers' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'PageCommonUserFields' },
                      },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'document' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'json' } },
                { kind: 'Field', name: { kind: 'Name', value: 'html' } },
                { kind: 'Field', name: { kind: 'Name', value: 'markdown' } },
                { kind: 'Field', name: { kind: 'Name', value: 'markdownToc' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'commentsParticipants' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageAuthorFields' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'collectsCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'archivedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isArchived' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'viewerHasCollected' },
            directives: [
              {
                kind: 'Directive',
                name: { kind: 'Name', value: 'include' },
                arguments: [
                  {
                    kind: 'Argument',
                    name: { kind: 'Name', value: 'if' },
                    value: { kind: 'Variable', name: { kind: 'Name', value: 'userHasLogin' } },
                  },
                ],
              },
            ],
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'viewerHasUpvoted' },
            directives: [
              {
                kind: 'Directive',
                name: { kind: 'Name', value: 'include' },
                arguments: [
                  {
                    kind: 'Argument',
                    name: { kind: 'Name', value: 'if' },
                    value: { kind: 'Variable', name: { kind: 'Name', value: 'userHasLogin' } },
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<ChangelogQuery, ChangelogQueryVariables>
export const PagedChangelogsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'PagedChangelogs' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'filter' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'PagedChangelogsFilter' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'userHasLogin' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Boolean' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pagedChangelogs' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'filter' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'filter' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'entries' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'PageChangelogFields' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'meta' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'latestUpvotedUsers' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'FragmentSpread',
                                    name: { kind: 'Name', value: 'PageCommonUserFields' },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'digest' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'linkAddr' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'commentsParticipants' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'FragmentSpread',
                              name: { kind: 'Name', value: 'PageAuthorFields' },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'viewerHasViewed' },
                        directives: [
                          {
                            kind: 'Directive',
                            name: { kind: 'Name', value: 'include' },
                            arguments: [
                              {
                                kind: 'Argument',
                                name: { kind: 'Name', value: 'if' },
                                value: {
                                  kind: 'Variable',
                                  name: { kind: 'Name', value: 'userHasLogin' },
                                },
                              },
                            ],
                          },
                        ],
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'viewerHasUpvoted' },
                        directives: [
                          {
                            kind: 'Directive',
                            name: { kind: 'Name', value: 'include' },
                            arguments: [
                              {
                                kind: 'Argument',
                                name: { kind: 'Name', value: 'if' },
                                value: {
                                  kind: 'Variable',
                                  name: { kind: 'Name', value: 'userHasLogin' },
                                },
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                },
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageChangelogPageInfo' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageAuthorFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'User' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageCommunityFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Community' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
          { kind: 'Field', name: { kind: 'Name', value: 'logo' } },
          { kind: 'Field', name: { kind: 'Name', value: 'subscribersCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'homepage' } },
          { kind: 'Field', name: { kind: 'Name', value: 'articlesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'views' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pending' } },
          { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageTagFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommunityTag' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'layout' } },
          { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
          { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
          { kind: 'Field', name: { kind: 'Name', value: 'color' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
          { kind: 'Field', name: { kind: 'Name', value: 'group' } },
          { kind: 'Field', name: { kind: 'Name', value: 'groupId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'slug' } }],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageChangelogFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Changelog' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isPinned' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'activeAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'views' } },
          { kind: 'Field', name: { kind: 'Name', value: 'commentsCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'upvotesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'commentsParticipantsCount' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'author' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageAuthorFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageCommunityFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'communities' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageCommunityFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'communityTags' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageTagFields' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageCommonUserFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommonUser' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageChangelogPageInfo' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'PagedChangelogs' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'totalPages' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageSize' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageNumber' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PagedChangelogsQuery, PagedChangelogsQueryVariables>
export const PageSubscribedCommunitiesDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'PageSubscribedCommunities' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'login' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'filter' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'PagiFilter' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'subscribedCommunities' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'login' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'login' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'filter' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'filter' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'entries' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'PageCommunityFields' },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'contributesDigest' } },
                    ],
                  },
                },
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageCommunityPageInfo' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageCommunityFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Community' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
          { kind: 'Field', name: { kind: 'Name', value: 'logo' } },
          { kind: 'Field', name: { kind: 'Name', value: 'subscribersCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'homepage' } },
          { kind: 'Field', name: { kind: 'Name', value: 'articlesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'views' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pending' } },
          { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageCommunityPageInfo' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'PagedCommunities' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'totalPages' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageSize' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageNumber' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  PageSubscribedCommunitiesQuery,
  PageSubscribedCommunitiesQueryVariables
>
export const PageCommunityDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'PageCommunity' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'slug' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'userHasLogin' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Boolean' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'incViews' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Boolean' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'slug' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'slug' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'incViews' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'incViews' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
                { kind: 'Field', name: { kind: 'Name', value: 'index' } },
                { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
                { kind: 'Field', name: { kind: 'Name', value: 'logo' } },
                { kind: 'Field', name: { kind: 'Name', value: 'subscribersCount' } },
                { kind: 'Field', name: { kind: 'Name', value: 'homepage' } },
                { kind: 'Field', name: { kind: 'Name', value: 'articlesCount' } },
                { kind: 'Field', name: { kind: 'Name', value: 'views' } },
                { kind: 'Field', name: { kind: 'Name', value: 'pending' } },
                { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
                { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'viewerHasSubscribed' },
                  directives: [
                    {
                      kind: 'Directive',
                      name: { kind: 'Name', value: 'include' },
                      arguments: [
                        {
                          kind: 'Argument',
                          name: { kind: 'Name', value: 'if' },
                          value: {
                            kind: 'Variable',
                            name: { kind: 'Name', value: 'userHasLogin' },
                          },
                        },
                      ],
                    },
                  ],
                },
                { kind: 'Field', name: { kind: 'Name', value: 'contributesDigest' } },
                { kind: 'Field', name: { kind: 'Name', value: 'moderatorsCount' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'meta' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'postsCount' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'blogsCount' } },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'moderators' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'isRoot' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'passportItemCount' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'user' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'login' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
                          ],
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'dashboard' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'baseInfo' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'locale' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'favicon' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'homepage' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'logo' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'city' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'techstack' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'introduction' } },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'mediaReports' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'siteName' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'favicon' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'index' } },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'thirdPartyAnalytics' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'enabled' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'measurementId' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'containerId' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'projectId' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'domain' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'siteId' } },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'enabledThirdPartyAnalytics' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'enabled' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'measurementId' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'containerId' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'projectId' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'domain' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'siteId' } },
                          ],
                        },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'umamiWebsiteId' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'docFaq' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'groupedView' } },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'groupItems' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                                  { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                                  { kind: 'Field', name: { kind: 'Name', value: 'index' } },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'items' },
                                    selectionSet: {
                                      kind: 'SelectionSet',
                                      selections: [
                                        { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                                        { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                                        { kind: 'Field', name: { kind: 'Name', value: 'detail' } },
                                        { kind: 'Field', name: { kind: 'Name', value: 'index' } },
                                      ],
                                    },
                                  },
                                ],
                              },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'flatItems' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                                  { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                                  { kind: 'Field', name: { kind: 'Name', value: 'detail' } },
                                  { kind: 'Field', name: { kind: 'Name', value: 'index' } },
                                ],
                              },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'wallpaper' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'light' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                                  { kind: 'Field', name: { kind: 'Name', value: 'source' } },
                                  { kind: 'Field', name: { kind: 'Name', value: 'gradient' } },
                                  { kind: 'Field', name: { kind: 'Name', value: 'pattern' } },
                                  { kind: 'Field', name: { kind: 'Name', value: 'contentShadow' } },
                                  { kind: 'Field', name: { kind: 'Name', value: 'effect' } },
                                  { kind: 'Field', name: { kind: 'Name', value: 'texture' } },
                                ],
                              },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'dark' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                                  { kind: 'Field', name: { kind: 'Name', value: 'source' } },
                                  { kind: 'Field', name: { kind: 'Name', value: 'gradient' } },
                                  { kind: 'Field', name: { kind: 'Name', value: 'pattern' } },
                                  { kind: 'Field', name: { kind: 'Name', value: 'contentShadow' } },
                                  { kind: 'Field', name: { kind: 'Name', value: 'effect' } },
                                  { kind: 'Field', name: { kind: 'Name', value: 'texture' } },
                                ],
                              },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'headerLinks' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'links' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                                  { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                                  { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                                ],
                              },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'footerLinks' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'links' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                                  { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                                  { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                                ],
                              },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'footerOnelineLinks' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'socialLinks' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'link' } },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'seo' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'seoEnable' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'ogSiteName' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'ogTitle' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'ogDescription' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'ogUrl' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'ogImage' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'twTitle' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'twDescription' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'twUrl' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'twCard' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'twSite' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'twImage' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'twImageWidth' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'twImageHeight' } },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'nameAlias' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'original' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'group' } },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'layout' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'themePreset' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'themePresetBase' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'themeTokens' } },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'themePresets' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  { kind: 'Field', name: { kind: 'Name', value: 'value' } },
                                  { kind: 'Field', name: { kind: 'Name', value: 'tokens' } },
                                ],
                              },
                            },
                            { kind: 'Field', name: { kind: 'Name', value: 'postLayout' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'docCoverLayout' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'docFaqLayout' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'tagLayout' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'inlineTagLayout' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'avatarLayout' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'brandLayout' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'communityLayout' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'navActiveLayout' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'topbarEnabled' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'topbarBg' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'topbarBgCustomColor' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'broadcastLayout' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'broadcastBg' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'broadcastCustomBg' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'broadcastArticleBg' } },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'broadcastArticleCustomBg' },
                            },
                            { kind: 'Field', name: { kind: 'Name', value: 'kanbanLayout' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'kanbanCardLayout' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'kanbanBoards' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'kanbanBgColors' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'changelogLayout' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'headerLayout' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'footerLayout' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'overlayDark' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'broadcastEnable' } },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'enable' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'post' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'kanban' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'changelog' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'doc' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'about' } },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PageCommunityQuery, PageCommunityQueryVariables>
export const PagePagedCommunitiesDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'PagePagedCommunities' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'filter' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'CommunitiesFilter' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'userHasLogin' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Boolean' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pagedCommunities' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'filter' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'filter' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'entries' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'PageCommunityFields' },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'contributesDigest' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'viewerHasSubscribed' },
                        directives: [
                          {
                            kind: 'Directive',
                            name: { kind: 'Name', value: 'include' },
                            arguments: [
                              {
                                kind: 'Argument',
                                name: { kind: 'Name', value: 'if' },
                                value: {
                                  kind: 'Variable',
                                  name: { kind: 'Name', value: 'userHasLogin' },
                                },
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                },
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageCommunityPageInfo' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageCommunityFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Community' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
          { kind: 'Field', name: { kind: 'Name', value: 'logo' } },
          { kind: 'Field', name: { kind: 'Name', value: 'subscribersCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'homepage' } },
          { kind: 'Field', name: { kind: 'Name', value: 'articlesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'views' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pending' } },
          { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageCommunityPageInfo' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'PagedCommunities' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'totalPages' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageSize' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageNumber' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PagePagedCommunitiesQuery, PagePagedCommunitiesQueryVariables>
export const PageDocDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'PageDoc' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ArticlePathInput' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'userHasLogin' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Boolean' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'doc' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'article' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageDocFields' } },
                { kind: 'Field', name: { kind: 'Name', value: 'subtitle' } },
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageDocDetailFields' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageAuthorFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'User' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageCommunityFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Community' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
          { kind: 'Field', name: { kind: 'Name', value: 'logo' } },
          { kind: 'Field', name: { kind: 'Name', value: 'subscribersCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'homepage' } },
          { kind: 'Field', name: { kind: 'Name', value: 'articlesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'views' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pending' } },
          { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageTagFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommunityTag' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'layout' } },
          { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
          { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
          { kind: 'Field', name: { kind: 'Name', value: 'color' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
          { kind: 'Field', name: { kind: 'Name', value: 'group' } },
          { kind: 'Field', name: { kind: 'Name', value: 'groupId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'slug' } }],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageCommonUserFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommonUser' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageDocFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Doc' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isPinned' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'activeAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'views' } },
          { kind: 'Field', name: { kind: 'Name', value: 'commentsCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'upvotesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'commentsParticipantsCount' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'author' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageAuthorFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageCommunityFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'communities' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageCommunityFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'communityTags' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageTagFields' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageDocDetailFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Doc' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'meta' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
                { kind: 'Field', name: { kind: 'Name', value: 'isEdited' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'latestUpvotedUsers' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'PageCommonUserFields' },
                      },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'document' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'json' } },
                { kind: 'Field', name: { kind: 'Name', value: 'html' } },
                { kind: 'Field', name: { kind: 'Name', value: 'markdown' } },
                { kind: 'Field', name: { kind: 'Name', value: 'markdownToc' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'commentsParticipants' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageAuthorFields' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'collectsCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'archivedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isArchived' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'viewerHasCollected' },
            directives: [
              {
                kind: 'Directive',
                name: { kind: 'Name', value: 'include' },
                arguments: [
                  {
                    kind: 'Argument',
                    name: { kind: 'Name', value: 'if' },
                    value: { kind: 'Variable', name: { kind: 'Name', value: 'userHasLogin' } },
                  },
                ],
              },
            ],
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'viewerHasUpvoted' },
            directives: [
              {
                kind: 'Directive',
                name: { kind: 'Name', value: 'include' },
                arguments: [
                  {
                    kind: 'Argument',
                    name: { kind: 'Name', value: 'if' },
                    value: { kind: 'Variable', name: { kind: 'Name', value: 'userHasLogin' } },
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PageDocQuery, PageDocQueryVariables>
export const PageDocPublicTreeDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'PageDocPublicTree' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'docPublicTree' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'tabs' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'PageDocPublicTreeNodeFields' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'pins' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'FragmentSpread',
                              name: { kind: 'Name', value: 'PageDocPublicTreeNodeFields' },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'groups' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'FragmentSpread',
                              name: { kind: 'Name', value: 'PageDocPublicTreeGroupFields' },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageDocPublicTreeNodeFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DocPublicTreeNode' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'parentNodeId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'docId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'type' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          { kind: 'Field', name: { kind: 'Name', value: 'href' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'appearance' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'light' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bg' } },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'dark' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bg' } },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'badge' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageDocPublicTreeChildFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DocPublicTreeNode' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageDocPublicTreeNodeFields' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pages' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'PageDocPublicTreeNodeFields' },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageDocPublicTreeGroupFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DocPublicTreeNode' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageDocPublicTreeNodeFields' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pages' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'PageDocPublicTreeChildFields' },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PageDocPublicTreeQuery, PageDocPublicTreeQueryVariables>
export const PagePagedDocsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'PagePagedDocs' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'filter' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'PagedDocsFilter' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'userHasLogin' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Boolean' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pagedDocs' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'filter' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'filter' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'entries' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageDocFields' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'meta' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'latestUpvotedUsers' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'FragmentSpread',
                                    name: { kind: 'Name', value: 'PageCommonUserFields' },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'commentsParticipants' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'FragmentSpread',
                              name: { kind: 'Name', value: 'PageAuthorFields' },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'viewerHasViewed' },
                        directives: [
                          {
                            kind: 'Directive',
                            name: { kind: 'Name', value: 'include' },
                            arguments: [
                              {
                                kind: 'Argument',
                                name: { kind: 'Name', value: 'if' },
                                value: {
                                  kind: 'Variable',
                                  name: { kind: 'Name', value: 'userHasLogin' },
                                },
                              },
                            ],
                          },
                        ],
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'viewerHasUpvoted' },
                        directives: [
                          {
                            kind: 'Directive',
                            name: { kind: 'Name', value: 'include' },
                            arguments: [
                              {
                                kind: 'Argument',
                                name: { kind: 'Name', value: 'if' },
                                value: {
                                  kind: 'Variable',
                                  name: { kind: 'Name', value: 'userHasLogin' },
                                },
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                },
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageDocPageInfo' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageAuthorFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'User' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageCommunityFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Community' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
          { kind: 'Field', name: { kind: 'Name', value: 'logo' } },
          { kind: 'Field', name: { kind: 'Name', value: 'subscribersCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'homepage' } },
          { kind: 'Field', name: { kind: 'Name', value: 'articlesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'views' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pending' } },
          { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageTagFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommunityTag' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'layout' } },
          { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
          { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
          { kind: 'Field', name: { kind: 'Name', value: 'color' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
          { kind: 'Field', name: { kind: 'Name', value: 'group' } },
          { kind: 'Field', name: { kind: 'Name', value: 'groupId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'slug' } }],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageDocFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Doc' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isPinned' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'activeAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'views' } },
          { kind: 'Field', name: { kind: 'Name', value: 'commentsCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'upvotesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'commentsParticipantsCount' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'author' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageAuthorFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageCommunityFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'communities' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageCommunityFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'communityTags' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageTagFields' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageCommonUserFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommonUser' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageDocPageInfo' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'PagedDocs' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'totalPages' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageSize' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageNumber' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PagePagedDocsQuery, PagePagedDocsQueryVariables>
export const PageCommunityTagGroupsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'PageCommunityTagGroups' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'thread' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Thread' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'communityTagGroups' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'thread' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'thread' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                { kind: 'Field', name: { kind: 'Name', value: 'index' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'tags' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageTagFields' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageTagFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommunityTag' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'layout' } },
          { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
          { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
          { kind: 'Field', name: { kind: 'Name', value: 'color' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
          { kind: 'Field', name: { kind: 'Name', value: 'group' } },
          { kind: 'Field', name: { kind: 'Name', value: 'groupId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'slug' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PageCommunityTagGroupsQuery, PageCommunityTagGroupsQueryVariables>
export const CommunityTagStatsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'CommunityTagStats' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'thread' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Thread' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'slug' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'communityTagStats' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'thread' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'thread' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'slug' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'slug' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'contentsCount' } },
                { kind: 'Field', name: { kind: 'Name', value: 'todayContentsCount' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CommunityTagStatsQuery, CommunityTagStatsQueryVariables>
export const ThemePresetsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'ThemePresets' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'themePresets' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'value' } },
                { kind: 'Field', name: { kind: 'Name', value: 'tokens' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<ThemePresetsQuery, ThemePresetsQueryVariables>
export const PagePagedCategoriesDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'PagePagedCategories' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'filter' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'PagiFilter' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pagedCategories' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'filter' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'filter' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'entries' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'index' } },
                    ],
                  },
                },
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageCategoryPageInfo' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageCategoryPageInfo' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'PagedCategories' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'totalPages' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageSize' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageNumber' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PagePagedCategoriesQuery, PagePagedCategoriesQueryVariables>
export const PostDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'Post' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ArticlePathInput' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'userHasLogin' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Boolean' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'post' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'article' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PagePostFields' } },
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PagePostDetailFields' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageAuthorFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'User' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageCommunityFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Community' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
          { kind: 'Field', name: { kind: 'Name', value: 'logo' } },
          { kind: 'Field', name: { kind: 'Name', value: 'subscribersCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'homepage' } },
          { kind: 'Field', name: { kind: 'Name', value: 'articlesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'views' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pending' } },
          { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageTagFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommunityTag' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'layout' } },
          { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
          { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
          { kind: 'Field', name: { kind: 'Name', value: 'color' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
          { kind: 'Field', name: { kind: 'Name', value: 'group' } },
          { kind: 'Field', name: { kind: 'Name', value: 'groupId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'slug' } }],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageCommonUserFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommonUser' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PagePostFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Post' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isPinned' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'activeAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'views' } },
          { kind: 'Field', name: { kind: 'Name', value: 'commentsCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'upvotesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'commentsParticipantsCount' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'author' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageAuthorFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageCommunityFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'communities' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageCommunityFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'communityTags' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageTagFields' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PagePostDetailFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Post' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'meta' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
                { kind: 'Field', name: { kind: 'Name', value: 'isEdited' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'latestUpvotedUsers' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'PageCommonUserFields' },
                      },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'document' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'json' } },
                { kind: 'Field', name: { kind: 'Name', value: 'html' } },
                { kind: 'Field', name: { kind: 'Name', value: 'markdown' } },
                { kind: 'Field', name: { kind: 'Name', value: 'markdownToc' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'commentsParticipants' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageAuthorFields' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'collectsCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'archivedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isArchived' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'viewerHasCollected' },
            directives: [
              {
                kind: 'Directive',
                name: { kind: 'Name', value: 'include' },
                arguments: [
                  {
                    kind: 'Argument',
                    name: { kind: 'Name', value: 'if' },
                    value: { kind: 'Variable', name: { kind: 'Name', value: 'userHasLogin' } },
                  },
                ],
              },
            ],
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'viewerHasUpvoted' },
            directives: [
              {
                kind: 'Directive',
                name: { kind: 'Name', value: 'include' },
                arguments: [
                  {
                    kind: 'Argument',
                    name: { kind: 'Name', value: 'if' },
                    value: { kind: 'Variable', name: { kind: 'Name', value: 'userHasLogin' } },
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PostQuery, PostQueryVariables>
export const PagedPostsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'PagedPosts' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'filter' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'PagedPostsFilter' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'userHasLogin' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Boolean' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pagedPosts' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'filter' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'filter' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'entries' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PagePostFields' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'cat' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'meta' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'latestUpvotedUsers' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'FragmentSpread',
                                    name: { kind: 'Name', value: 'PageCommonUserFields' },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'digest' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'commentsParticipants' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'FragmentSpread',
                              name: { kind: 'Name', value: 'PageAuthorFields' },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'viewerHasViewed' },
                        directives: [
                          {
                            kind: 'Directive',
                            name: { kind: 'Name', value: 'include' },
                            arguments: [
                              {
                                kind: 'Argument',
                                name: { kind: 'Name', value: 'if' },
                                value: {
                                  kind: 'Variable',
                                  name: { kind: 'Name', value: 'userHasLogin' },
                                },
                              },
                            ],
                          },
                        ],
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'viewerHasUpvoted' },
                        directives: [
                          {
                            kind: 'Directive',
                            name: { kind: 'Name', value: 'include' },
                            arguments: [
                              {
                                kind: 'Argument',
                                name: { kind: 'Name', value: 'if' },
                                value: {
                                  kind: 'Variable',
                                  name: { kind: 'Name', value: 'userHasLogin' },
                                },
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                },
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PagePostPageInfo' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageAuthorFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'User' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageCommunityFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Community' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
          { kind: 'Field', name: { kind: 'Name', value: 'logo' } },
          { kind: 'Field', name: { kind: 'Name', value: 'subscribersCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'homepage' } },
          { kind: 'Field', name: { kind: 'Name', value: 'articlesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'views' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pending' } },
          { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageTagFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommunityTag' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'layout' } },
          { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
          { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
          { kind: 'Field', name: { kind: 'Name', value: 'color' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
          { kind: 'Field', name: { kind: 'Name', value: 'group' } },
          { kind: 'Field', name: { kind: 'Name', value: 'groupId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'slug' } }],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PagePostFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Post' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isPinned' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'activeAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'views' } },
          { kind: 'Field', name: { kind: 'Name', value: 'commentsCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'upvotesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'commentsParticipantsCount' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'author' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageAuthorFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageCommunityFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'communities' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageCommunityFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'communityTags' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageTagFields' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageCommonUserFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommonUser' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PagePostPageInfo' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'PagedPosts' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'totalPages' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageSize' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageNumber' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PagedPostsQuery, PagedPostsQueryVariables>
export const PagedPublishedPostsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'PagedPublishedPosts' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'login' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'filter' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'PagiFilter' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'userHasLogin' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Boolean' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pagedPublishedPosts' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'login' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'login' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'filter' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'filter' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'entries' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PagePostFields' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'meta' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [{ kind: 'Field', name: { kind: 'Name', value: 'thread' } }],
                        },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'digest' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'linkAddr' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'commentsParticipants' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'FragmentSpread',
                              name: { kind: 'Name', value: 'PageAuthorFields' },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'viewerHasViewed' },
                        directives: [
                          {
                            kind: 'Directive',
                            name: { kind: 'Name', value: 'include' },
                            arguments: [
                              {
                                kind: 'Argument',
                                name: { kind: 'Name', value: 'if' },
                                value: {
                                  kind: 'Variable',
                                  name: { kind: 'Name', value: 'userHasLogin' },
                                },
                              },
                            ],
                          },
                        ],
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'viewerHasUpvoted' },
                        directives: [
                          {
                            kind: 'Directive',
                            name: { kind: 'Name', value: 'include' },
                            arguments: [
                              {
                                kind: 'Argument',
                                name: { kind: 'Name', value: 'if' },
                                value: {
                                  kind: 'Variable',
                                  name: { kind: 'Name', value: 'userHasLogin' },
                                },
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                },
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PagePostPageInfo' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageAuthorFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'User' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageCommunityFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Community' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
          { kind: 'Field', name: { kind: 'Name', value: 'logo' } },
          { kind: 'Field', name: { kind: 'Name', value: 'subscribersCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'homepage' } },
          { kind: 'Field', name: { kind: 'Name', value: 'articlesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'views' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pending' } },
          { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageTagFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommunityTag' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'layout' } },
          { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
          { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
          { kind: 'Field', name: { kind: 'Name', value: 'color' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
          { kind: 'Field', name: { kind: 'Name', value: 'group' } },
          { kind: 'Field', name: { kind: 'Name', value: 'groupId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'slug' } }],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PagePostFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Post' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isPinned' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'activeAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'views' } },
          { kind: 'Field', name: { kind: 'Name', value: 'commentsCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'upvotesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'commentsParticipantsCount' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'author' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageAuthorFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageCommunityFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'communities' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageCommunityFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'communityTags' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PageTagFields' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PagePostPageInfo' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'PagedPosts' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'totalPages' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageSize' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageNumber' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PagedPublishedPostsQuery, PagedPublishedPostsQueryVariables>
export const PagesGroupedKanbanPostsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'PagesGroupedKanbanPosts' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'groupedKanbanPosts' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'backlog' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'entries' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'cat' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'community' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
                                ],
                              },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'meta' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
                                ],
                              },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'author' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'FragmentSpread',
                                    name: { kind: 'Name', value: 'PageAuthorFields' },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                      { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PagePostPageInfo' } },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'todo' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'entries' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'cat' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'community' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
                                ],
                              },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'meta' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
                                ],
                              },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'author' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'FragmentSpread',
                                    name: { kind: 'Name', value: 'PageAuthorFields' },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                      { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PagePostPageInfo' } },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'wip' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'entries' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'cat' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'community' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
                                ],
                              },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'meta' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
                                ],
                              },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'author' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'FragmentSpread',
                                    name: { kind: 'Name', value: 'PageAuthorFields' },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                      { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PagePostPageInfo' } },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'done' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'entries' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'cat' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'community' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
                                ],
                              },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'meta' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
                                ],
                              },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'author' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'FragmentSpread',
                                    name: { kind: 'Name', value: 'PageAuthorFields' },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                      { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PagePostPageInfo' } },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'rejected' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'entries' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'cat' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'community' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
                                ],
                              },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'meta' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
                                ],
                              },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'author' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'FragmentSpread',
                                    name: { kind: 'Name', value: 'PageAuthorFields' },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                      { kind: 'FragmentSpread', name: { kind: 'Name', value: 'PagePostPageInfo' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PageAuthorFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'User' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PagePostPageInfo' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'PagedPosts' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'totalPages' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageSize' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageNumber' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PagesGroupedKanbanPostsQuery, PagesGroupedKanbanPostsQueryVariables>
export const MeDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'Me' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'me' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'login' } },
                { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
                { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
                { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
                { kind: 'Field', name: { kind: 'Name', value: 'passport' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<MeQuery, MeQueryVariables>
export const UserDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'User' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'login' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'userHasLogin' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Boolean' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'user' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'login' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'login' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'UserAuthorFields' } },
                { kind: 'Field', name: { kind: 'Name', value: 'views' } },
                { kind: 'Field', name: { kind: 'Name', value: 'sex' } },
                { kind: 'Field', name: { kind: 'Name', value: 'location' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'social' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'FragmentSpread', name: { kind: 'Name', value: 'UserSocialFields' } },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'meta' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'isMaker' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'publishedPostsCount' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'publishedBlogsCount' } },
                    ],
                  },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'followersCount' } },
                { kind: 'Field', name: { kind: 'Name', value: 'followingsCount' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'viewerHasFollowed' },
                  directives: [
                    {
                      kind: 'Directive',
                      name: { kind: 'Name', value: 'include' },
                      arguments: [
                        {
                          kind: 'Argument',
                          name: { kind: 'Name', value: 'if' },
                          value: {
                            kind: 'Variable',
                            name: { kind: 'Name', value: 'userHasLogin' },
                          },
                        },
                      ],
                    },
                  ],
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'achievement' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'UserAchievementFields' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'contributes' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'records' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'count' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'date' } },
                          ],
                        },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'startDate' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'endDate' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
                    ],
                  },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'subscribedCommunitiesCount' } },
                { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'UserAuthorFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'User' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'UserSocialFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'SocialMap' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'github' } },
          { kind: 'Field', name: { kind: 'Name', value: 'twitter' } },
          { kind: 'Field', name: { kind: 'Name', value: 'company' } },
          { kind: 'Field', name: { kind: 'Name', value: 'blog' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'UserAchievementFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Achievement' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'reputation' } },
          { kind: 'Field', name: { kind: 'Name', value: 'articlesUpvotesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'articlesCollectsCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'donateMember' } },
          { kind: 'Field', name: { kind: 'Name', value: 'seniorMember' } },
          { kind: 'Field', name: { kind: 'Name', value: 'sponsorMember' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<UserQuery, UserQueryVariables>
export const SessionStateDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'SessionState' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'sessionState' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'isValid' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'user' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'FragmentSpread', name: { kind: 'Name', value: 'UserAuthorFields' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'geoCity' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'location' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'social' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'FragmentSpread',
                              name: { kind: 'Name', value: 'UserSocialFields' },
                            },
                          ],
                        },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'passport' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'subscribedCommunitiesCount' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'achievement' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'FragmentSpread',
                              name: { kind: 'Name', value: 'UserAchievementFields' },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'UserAuthorFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'User' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'UserSocialFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'SocialMap' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'github' } },
          { kind: 'Field', name: { kind: 'Name', value: 'twitter' } },
          { kind: 'Field', name: { kind: 'Name', value: 'company' } },
          { kind: 'Field', name: { kind: 'Name', value: 'blog' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'UserAchievementFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Achievement' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'reputation' } },
          { kind: 'Field', name: { kind: 'Name', value: 'articlesUpvotesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'articlesCollectsCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'donateMember' } },
          { kind: 'Field', name: { kind: 'Name', value: 'seniorMember' } },
          { kind: 'Field', name: { kind: 'Name', value: 'sponsorMember' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<SessionStateQuery, SessionStateQueryVariables>
export const AboutSimpleQueryDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'AboutSimpleQuery' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ArticlePathInput' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'post' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'article' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'innerId' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<AboutSimpleQueryQuery, AboutSimpleQueryQueryVariables>
export const CreatePostDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'CreatePost' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'title' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'bodyBag' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ArtimentBodyBagInput' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'communityTags' } },
          type: {
            kind: 'ListType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'linkAddr' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'copyRight' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'createPost' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'title' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'title' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'bodyBag' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'bodyBag' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'communityTags' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'communityTags' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'linkAddr' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'linkAddr' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'copyRight' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'copyRight' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'meta' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [{ kind: 'Field', name: { kind: 'Name', value: 'thread' } }],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CreatePostMutation, CreatePostMutationVariables>
export const UpdatePostFromEditorDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdatePostFromEditor' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ArticlePathInput' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'title' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'bodyBag' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'ArtimentBodyBagInput' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'linkAddr' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'copyRight' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'communityTags' } },
          type: {
            kind: 'ListType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updatePost' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'article' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'title' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'title' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'bodyBag' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'bodyBag' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'linkAddr' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'linkAddr' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'copyRight' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'copyRight' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'communityTags' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'communityTags' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'author' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'ArticleEditorAuthorFields' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'meta' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'isLegal' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'illegalReason' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'illegalWords' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ArticleEditorAuthorFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'User' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<UpdatePostFromEditorMutation, UpdatePostFromEditorMutationVariables>
export const ArticleEditorCommunityDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'ArticleEditorCommunity' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'slug' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'slug' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'slug' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'logo' } },
                { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
                { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
                { kind: 'Field', name: { kind: 'Name', value: 'subscribersCount' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<ArticleEditorCommunityQuery, ArticleEditorCommunityQueryVariables>
export const ArticleEditorPostDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'ArticleEditorPost' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ArticlePathInput' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'post' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'article' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                { kind: 'Field', name: { kind: 'Name', value: 'linkAddr' } },
                { kind: 'Field', name: { kind: 'Name', value: 'copyRight' } },
                { kind: 'Field', name: { kind: 'Name', value: 'archivedAt' } },
                { kind: 'Field', name: { kind: 'Name', value: 'isArchived' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'author' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'ArticleEditorAuthorFields' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'community' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'ArticleEditorCommunityFields' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'communityTags' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'ArticleEditorTagFields' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'meta' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'isLegal' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'illegalReason' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'illegalWords' } },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'document' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [{ kind: 'Field', name: { kind: 'Name', value: 'json' } }],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ArticleEditorAuthorFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'User' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ArticleEditorCommunityFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Community' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
          { kind: 'Field', name: { kind: 'Name', value: 'logo' } },
          { kind: 'Field', name: { kind: 'Name', value: 'subscribersCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'homepage' } },
          { kind: 'Field', name: { kind: 'Name', value: 'articlesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'views' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pending' } },
          { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ArticleEditorTagFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommunityTag' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'layout' } },
          { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
          { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
          { kind: 'Field', name: { kind: 'Name', value: 'color' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
          { kind: 'Field', name: { kind: 'Name', value: 'group' } },
          { kind: 'Field', name: { kind: 'Name', value: 'groupId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'slug' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<ArticleEditorPostQuery, ArticleEditorPostQueryVariables>
export const UpdatePostFromMenuDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdatePostFromMenu' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ArticlePathInput' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'title' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'communityTags' } },
          type: {
            kind: 'ListType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updatePost' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'article' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'title' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'title' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'communityTags' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'communityTags' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'communityTags' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'ArticleMenuTagFields' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ArticleMenuTagFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommunityTag' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'layout' } },
          { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
          { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
          { kind: 'Field', name: { kind: 'Name', value: 'color' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
          { kind: 'Field', name: { kind: 'Name', value: 'group' } },
          { kind: 'Field', name: { kind: 'Name', value: 'groupId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'slug' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<UpdatePostFromMenuMutation, UpdatePostFromMenuMutationVariables>
export const SetPostCatDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'SetPostCat' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ArticlePathInput' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'cat' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ArticleCatEnum' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'setPostCat' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'article' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'cat' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'cat' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'cat' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<SetPostCatMutation, SetPostCatMutationVariables>
export const SetPostStatusDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'SetPostStatus' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ArticlePathInput' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'status' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ArticleStatusEnum' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'setPostStatus' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'article' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'status' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'status' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'status' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<SetPostStatusMutation, SetPostStatusMutationVariables>
export const PinPostDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'PinPost' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ArticlePathInput' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pinPost' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'article' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'innerId' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PinPostMutation, PinPostMutationVariables>
export const UndoPinPostDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UndoPinPost' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ArticlePathInput' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'undoPinPost' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'article' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'isPinned' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<UndoPinPostMutation, UndoPinPostMutationVariables>
export const CommunityTagGroupsForMenuDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'CommunityTagGroupsForMenu' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'thread' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Thread' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'communityTagGroups' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'thread' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'thread' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                { kind: 'Field', name: { kind: 'Name', value: 'index' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'tags' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'ArticleMenuTagFields' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ArticleMenuTagFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommunityTag' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'layout' } },
          { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
          { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
          { kind: 'Field', name: { kind: 'Name', value: 'color' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
          { kind: 'Field', name: { kind: 'Name', value: 'group' } },
          { kind: 'Field', name: { kind: 'Name', value: 'groupId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'slug' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  CommunityTagGroupsForMenuQuery,
  CommunityTagGroupsForMenuQueryVariables
>
export const ChangelogSimpleQueryDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'ChangelogSimpleQuery' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ArticlePathInput' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'post' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'article' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'innerId' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<ChangelogSimpleQueryQuery, ChangelogSimpleQueryQueryVariables>
export const PagedCommentsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'PagedComments' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ArticlePathInput' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'mode' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'CommentsMode' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'filter' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'CommentsFilter' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pagedComments' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'article' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'mode' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'mode' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'filter' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'filter' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'entries' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'FragmentSpread', name: { kind: 'Name', value: 'CommentFields' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'replyToComment' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'FragmentSpread',
                              name: { kind: 'Name', value: 'CommentFields' },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'replies' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'FragmentSpread',
                              name: { kind: 'Name', value: 'CommentReplyFields' },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'CommentPageFields' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'CommentAuthorFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'User' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'CommentMetaFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommentMeta' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'isLegal' } },
          { kind: 'Field', name: { kind: 'Name', value: 'illegalReason' } },
          { kind: 'Field', name: { kind: 'Name', value: 'illegalWords' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isArticleAuthorUpvoted' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isReplyToOthers' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'CommentEmotionFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'EmotionStat' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'type' } },
          { kind: 'Field', name: { kind: 'Name', value: 'count' } },
          { kind: 'Field', name: { kind: 'Name', value: 'viewerHasReacted' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'latestUsers' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'login' } },
                { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
                { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'CommentFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Comment' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bodyHtml' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'author' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'CommentAuthorFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'meta' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'CommentMetaFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'emotions' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'CommentEmotionFields' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'isPinned' } },
          { kind: 'Field', name: { kind: 'Name', value: 'floor' } },
          { kind: 'Field', name: { kind: 'Name', value: 'upvotesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isArticleAuthor' } },
          { kind: 'Field', name: { kind: 'Name', value: 'viewerHasUpvoted' } },
          { kind: 'Field', name: { kind: 'Name', value: 'viewerHasReported' } },
          { kind: 'Field', name: { kind: 'Name', value: 'repliesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'CommentReplyFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommentReply' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bodyHtml' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'author' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'CommentAuthorFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'meta' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'CommentMetaFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'emotions' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'CommentEmotionFields' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'isPinned' } },
          { kind: 'Field', name: { kind: 'Name', value: 'floor' } },
          { kind: 'Field', name: { kind: 'Name', value: 'upvotesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isArticleAuthor' } },
          { kind: 'Field', name: { kind: 'Name', value: 'viewerHasUpvoted' } },
          { kind: 'Field', name: { kind: 'Name', value: 'viewerHasReported' } },
          { kind: 'Field', name: { kind: 'Name', value: 'repliesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'replyToComment' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'CommentFields' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'CommentPageFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'PagedComments' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'totalPages' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageSize' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageNumber' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PagedCommentsQuery, PagedCommentsQueryVariables>
export const PagedCommentRepliesDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'PagedCommentReplies' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'comment' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'CommentPathInput' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'filter' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'CommentsFilter' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pagedCommentReplies' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'comment' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'comment' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'filter' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'filter' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'entries' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'CommentReplyFields' },
                      },
                    ],
                  },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'totalPages' } },
                { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
                { kind: 'Field', name: { kind: 'Name', value: 'pageSize' } },
                { kind: 'Field', name: { kind: 'Name', value: 'pageNumber' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'CommentAuthorFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'User' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'CommentMetaFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommentMeta' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'isLegal' } },
          { kind: 'Field', name: { kind: 'Name', value: 'illegalReason' } },
          { kind: 'Field', name: { kind: 'Name', value: 'illegalWords' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isArticleAuthorUpvoted' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isReplyToOthers' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'CommentEmotionFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'EmotionStat' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'type' } },
          { kind: 'Field', name: { kind: 'Name', value: 'count' } },
          { kind: 'Field', name: { kind: 'Name', value: 'viewerHasReacted' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'latestUsers' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'login' } },
                { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
                { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'CommentFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Comment' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bodyHtml' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'author' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'CommentAuthorFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'meta' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'CommentMetaFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'emotions' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'CommentEmotionFields' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'isPinned' } },
          { kind: 'Field', name: { kind: 'Name', value: 'floor' } },
          { kind: 'Field', name: { kind: 'Name', value: 'upvotesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isArticleAuthor' } },
          { kind: 'Field', name: { kind: 'Name', value: 'viewerHasUpvoted' } },
          { kind: 'Field', name: { kind: 'Name', value: 'viewerHasReported' } },
          { kind: 'Field', name: { kind: 'Name', value: 'repliesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'CommentReplyFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommentReply' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bodyHtml' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'author' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'CommentAuthorFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'meta' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'CommentMetaFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'emotions' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'CommentEmotionFields' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'isPinned' } },
          { kind: 'Field', name: { kind: 'Name', value: 'floor' } },
          { kind: 'Field', name: { kind: 'Name', value: 'upvotesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isArticleAuthor' } },
          { kind: 'Field', name: { kind: 'Name', value: 'viewerHasUpvoted' } },
          { kind: 'Field', name: { kind: 'Name', value: 'viewerHasReported' } },
          { kind: 'Field', name: { kind: 'Name', value: 'repliesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'replyToComment' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'CommentFields' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PagedCommentRepliesQuery, PagedCommentRepliesQueryVariables>
export const CreateCommentDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'CreateComment' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ArticlePathInput' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'body' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'createComment' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'article' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'body' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'body' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'bodyHtml' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CreateCommentMutation, CreateCommentMutationVariables>
export const UpdateCommentDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdateComment' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'comment' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'CommentPathInput' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'body' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updateComment' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'comment' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'comment' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'body' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'body' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'bodyHtml' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'replyToComment' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [{ kind: 'Field', name: { kind: 'Name', value: 'innerId' } }],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<UpdateCommentMutation, UpdateCommentMutationVariables>
export const CommentsStateDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'CommentsState' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ArticlePathInput' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'freshkey' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'commentsState' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'article' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'freshkey' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'freshkey' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
                { kind: 'Field', name: { kind: 'Name', value: 'isViewerJoined' } },
                { kind: 'Field', name: { kind: 'Name', value: 'participantsCount' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'participants' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'login' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CommentsStateQuery, CommentsStateQueryVariables>
export const OneCommentDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'OneComment' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'comment' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'CommentPathInput' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'oneComment' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'comment' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'comment' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'body' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<OneCommentQuery, OneCommentQueryVariables>
export const ReplyCommentDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'ReplyComment' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'comment' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'CommentPathInput' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'body' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'replyComment' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'comment' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'comment' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'body' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'body' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'bodyHtml' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<ReplyCommentMutation, ReplyCommentMutationVariables>
export const DeleteCommentDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'DeleteComment' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'comment' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'CommentPathInput' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'deleteComment' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'comment' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'comment' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'innerId' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DeleteCommentMutation, DeleteCommentMutationVariables>
export const UpvoteCommentDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpvoteComment' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'comment' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'CommentPathInput' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'upvoteComment' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'comment' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'comment' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'meta' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'isArticleAuthorUpvoted' } },
                    ],
                  },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'upvotesCount' } },
                { kind: 'Field', name: { kind: 'Name', value: 'viewerHasUpvoted' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'replyToComment' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [{ kind: 'Field', name: { kind: 'Name', value: 'innerId' } }],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<UpvoteCommentMutation, UpvoteCommentMutationVariables>
export const UndoUpvoteCommentDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UndoUpvoteComment' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'comment' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'CommentPathInput' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'undoUpvoteComment' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'comment' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'comment' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'meta' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'isArticleAuthorUpvoted' } },
                    ],
                  },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'upvotesCount' } },
                { kind: 'Field', name: { kind: 'Name', value: 'viewerHasUpvoted' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'replyToComment' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [{ kind: 'Field', name: { kind: 'Name', value: 'innerId' } }],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<UndoUpvoteCommentMutation, UndoUpvoteCommentMutationVariables>
export const ReportCommentDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'ReportComment' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'comment' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'CommentPathInput' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'reason' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'attr' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'reportComment' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'comment' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'comment' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'reason' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'reason' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'attr' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'attr' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'viewerHasReported' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'meta' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [{ kind: 'Field', name: { kind: 'Name', value: 'reportedCount' } }],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<ReportCommentMutation, ReportCommentMutationVariables>
export const UndoReportCommentDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UndoReportComment' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'comment' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'CommentPathInput' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'undoReportComment' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'comment' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'comment' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'viewerHasReported' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'meta' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [{ kind: 'Field', name: { kind: 'Name', value: 'reportedCount' } }],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<UndoReportCommentMutation, UndoReportCommentMutationVariables>
export const EmotionToCommentDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'EmotionToComment' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'comment' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'CommentPathInput' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'emotion' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'CommentEmotion' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'emotionToComment' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'comment' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'comment' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'emotion' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'emotion' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'replyToComment' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [{ kind: 'Field', name: { kind: 'Name', value: 'innerId' } }],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'emotions' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'CommentEmotionFields' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'CommentEmotionFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'EmotionStat' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'type' } },
          { kind: 'Field', name: { kind: 'Name', value: 'count' } },
          { kind: 'Field', name: { kind: 'Name', value: 'viewerHasReacted' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'latestUsers' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'login' } },
                { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
                { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<EmotionToCommentMutation, EmotionToCommentMutationVariables>
export const UndoEmotionToCommentDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UndoEmotionToComment' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'comment' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'CommentPathInput' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'emotion' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'CommentEmotion' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'undoEmotionToComment' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'comment' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'comment' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'emotion' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'emotion' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'replyToComment' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [{ kind: 'Field', name: { kind: 'Name', value: 'innerId' } }],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'emotions' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'CommentEmotionFields' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'CommentEmotionFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'EmotionStat' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'type' } },
          { kind: 'Field', name: { kind: 'Name', value: 'count' } },
          { kind: 'Field', name: { kind: 'Name', value: 'viewerHasReacted' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'latestUsers' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'login' } },
                { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
                { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<UndoEmotionToCommentMutation, UndoEmotionToCommentMutationVariables>
export const SearchUsersDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'SearchUsers' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'name' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'searchUsers' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'name' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'name' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'entries' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'CommentAuthorFields' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'CommentAuthorFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'User' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<SearchUsersQuery, SearchUsersQueryVariables>
export const PagedPublishedCommentsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'PagedPublishedComments' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'login' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'thread' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Thread' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'filter' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'PagiFilter' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pagedPublishedComments' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'login' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'login' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'thread' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'thread' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'filter' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'filter' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'entries' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'FragmentSpread', name: { kind: 'Name', value: 'CommentFields' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'article' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'author' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
                                  { kind: 'Field', name: { kind: 'Name', value: 'login' } },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'CommentPageFields' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'CommentAuthorFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'User' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'CommentMetaFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommentMeta' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'isLegal' } },
          { kind: 'Field', name: { kind: 'Name', value: 'illegalReason' } },
          { kind: 'Field', name: { kind: 'Name', value: 'illegalWords' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isArticleAuthorUpvoted' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isReplyToOthers' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'CommentEmotionFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'EmotionStat' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'type' } },
          { kind: 'Field', name: { kind: 'Name', value: 'count' } },
          { kind: 'Field', name: { kind: 'Name', value: 'viewerHasReacted' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'latestUsers' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'login' } },
                { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
                { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'CommentFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Comment' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bodyHtml' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'author' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'CommentAuthorFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'meta' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'CommentMetaFields' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'emotions' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'CommentEmotionFields' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'isPinned' } },
          { kind: 'Field', name: { kind: 'Name', value: 'floor' } },
          { kind: 'Field', name: { kind: 'Name', value: 'upvotesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isArticleAuthor' } },
          { kind: 'Field', name: { kind: 'Name', value: 'viewerHasUpvoted' } },
          { kind: 'Field', name: { kind: 'Name', value: 'viewerHasReported' } },
          { kind: 'Field', name: { kind: 'Name', value: 'repliesCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'CommentPageFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'PagedComments' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'totalPages' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageSize' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageNumber' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PagedPublishedCommentsQuery, PagedPublishedCommentsQueryVariables>
export const CoverSimpleQueryDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'CoverSimpleQuery' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ArticlePathInput' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'post' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'article' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'innerId' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CoverSimpleQueryQuery, CoverSimpleQueryQueryVariables>
export const AnalysisTrendPagesDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'AnalysisTrendPages' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'days' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'dimension' } },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'AnalysisTrendPagesDimension' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'analysisTrendPages' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'days' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'days' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'dimension' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'dimension' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'items' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'value' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'label' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'metrics' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'visitors' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'visits' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'views' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bounceRate' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'visitDuration' } },
                          ],
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'error' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'section' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'providerStatus' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<AnalysisTrendPagesQuery, AnalysisTrendPagesQueryVariables>
export const AnalysisTrendSourcesDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'AnalysisTrendSources' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'days' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'dimension' } },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'AnalysisTrendSourcesDimension' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'analysisTrendSources' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'days' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'days' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'dimension' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'dimension' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'items' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'value' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'label' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'metrics' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'visitors' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'visits' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'views' } },
                          ],
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'error' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'section' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'providerStatus' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<AnalysisTrendSourcesQuery, AnalysisTrendSourcesQueryVariables>
export const AnalysisTrendEnvironmentDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'AnalysisTrendEnvironment' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'days' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'dimension' } },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'AnalysisTrendEnvironmentDimension' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'analysisTrendEnvironment' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'days' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'days' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'dimension' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'dimension' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'items' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'value' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'label' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'metrics' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'visitors' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'visits' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'views' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'percentage' } },
                          ],
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'error' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'section' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'providerStatus' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<AnalysisTrendEnvironmentQuery, AnalysisTrendEnvironmentQueryVariables>
export const AnalysisTrendLocationDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'AnalysisTrendLocation' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'days' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'dimension' } },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'AnalysisTrendLocationDimension' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'analysisTrendLocation' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'days' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'days' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'dimension' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'dimension' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'items' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'value' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'label' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'metrics' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'visitors' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'visits' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'views' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'percentage' } },
                          ],
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'error' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'section' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'providerStatus' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<AnalysisTrendLocationQuery, AnalysisTrendLocationQueryVariables>
export const AnalysisTrendTrafficDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'AnalysisTrendTraffic' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'days' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'analysisTrendTraffic' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'days' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'days' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                { kind: 'Field', name: { kind: 'Name', value: 'timezone' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'cells' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'weekday' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'hour' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'visitors' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'visits' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'views' } },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'error' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'section' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'providerStatus' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<AnalysisTrendTrafficQuery, AnalysisTrendTrafficQueryVariables>
export const AnalysisTrendsOverviewDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'AnalysisTrendsOverview' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'days' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'analysisTrendsOverview' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'days' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'days' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'range' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'days' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'startAt' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'endAt' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'bucket' } },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'summary' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'pageviews' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'value' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'previousValue' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'changeRate' } },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'visitors' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'value' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'previousValue' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'changeRate' } },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'visits' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'value' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'previousValue' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'changeRate' } },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'bounceRate' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'value' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'previousValue' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'changeRate' } },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'visitDuration' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'value' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'previousValue' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'changeRate' } },
                          ],
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'chart' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'bucket' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'points' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'timestamp' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'visits' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'views' } },
                          ],
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'errors' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'section' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'providerStatus' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<AnalysisTrendsOverviewQuery, AnalysisTrendsOverviewQueryVariables>
export const SaveCustomThemePresetDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'SaveCustomThemePreset' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'themePreset' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'DsbThemePreset' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'themePresetBase' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'DsbThemePreset' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'themeOverwrite' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Json' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'saveCustomThemePreset' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'themePreset' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'themePreset' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'themePresetBase' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'themePresetBase' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'themeOverwrite' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'themeOverwrite' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'layout' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'themePreset' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'themePresetBase' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'themeTokens' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'themePresets' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'value' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'tokens' } },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<SaveCustomThemePresetMutation, SaveCustomThemePresetMutationVariables>
export const SelectThemePresetDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'SelectThemePreset' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'themePreset' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'DsbThemePreset' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'selectThemePreset' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'themePreset' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'themePreset' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'layout' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'themePreset' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'themePresetBase' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'themeTokens' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'themePresets' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'value' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'tokens' } },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<SelectThemePresetMutation, SelectThemePresetMutationVariables>
export const UpdateDashboardWallpaperDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdateDashboardWallpaper' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'wallpaper' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'DsbWallpaperInput' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updateDashboardWallpaper' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'wallpaper' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'wallpaper' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'wallpaper' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'DashboardWallpaperFields' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardWallpaperFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DsbWallpaper' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'light' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'source' } },
                { kind: 'Field', name: { kind: 'Name', value: 'gradient' } },
                { kind: 'Field', name: { kind: 'Name', value: 'pattern' } },
                { kind: 'Field', name: { kind: 'Name', value: 'contentShadow' } },
                { kind: 'Field', name: { kind: 'Name', value: 'effect' } },
                { kind: 'Field', name: { kind: 'Name', value: 'texture' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'dark' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'source' } },
                { kind: 'Field', name: { kind: 'Name', value: 'gradient' } },
                { kind: 'Field', name: { kind: 'Name', value: 'pattern' } },
                { kind: 'Field', name: { kind: 'Name', value: 'contentShadow' } },
                { kind: 'Field', name: { kind: 'Name', value: 'effect' } },
                { kind: 'Field', name: { kind: 'Name', value: 'texture' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  UpdateDashboardWallpaperMutation,
  UpdateDashboardWallpaperMutationVariables
>
export const ContentImportJobDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'ContentImportJob' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'jobRef' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'contentImportJob' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'jobRef' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'jobRef' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'ContentImportJobFields' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ContentImportJobFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'ContentImportJob' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'status' } },
          { kind: 'Field', name: { kind: 'Name', value: 'progress' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'process' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'state' } },
                { kind: 'Field', name: { kind: 'Name', value: 'stage' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'progress' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'completed' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'total' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'unit' } },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'recentBatch' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'ref' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'label' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'state' } },
                    ],
                  },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'errorCode' } },
          { kind: 'Field', name: { kind: 'Name', value: 'errorMessage' } },
          { kind: 'Field', name: { kind: 'Name', value: 'failedItems' } },
          { kind: 'Field', name: { kind: 'Name', value: 'skipped' } },
          { kind: 'Field', name: { kind: 'Name', value: 'targetBranch' } },
          { kind: 'Field', name: { kind: 'Name', value: 'firstImportedDocRef' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'sourceInfo' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'repo' } },
                { kind: 'Field', name: { kind: 'Name', value: 'repoUrl' } },
                { kind: 'Field', name: { kind: 'Name', value: 'branch' } },
                { kind: 'Field', name: { kind: 'Name', value: 'commit' } },
                { kind: 'Field', name: { kind: 'Name', value: 'framework' } },
                { kind: 'Field', name: { kind: 'Name', value: 'contentRoot' } },
                { kind: 'Field', name: { kind: 'Name', value: 'configPaths' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'counts' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'tabs' } },
                { kind: 'Field', name: { kind: 'Name', value: 'groups' } },
                { kind: 'Field', name: { kind: 'Name', value: 'pages' } },
                { kind: 'Field', name: { kind: 'Name', value: 'links' } },
                { kind: 'Field', name: { kind: 'Name', value: 'assets' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'tree' } },
          { kind: 'Field', name: { kind: 'Name', value: 'badSmells' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<ContentImportJobQuery, ContentImportJobQueryVariables>
export const DashboardCommunityModeratorsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'DashboardCommunityModerators' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'slug' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'incViews' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Boolean' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'slug' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'slug' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'incViews' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'incViews' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'moderators' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'isRoot' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'passportItemCount' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'user' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'login' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  DashboardCommunityModeratorsQuery,
  DashboardCommunityModeratorsQueryVariables
>
export const DashboardUserPassportDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'DashboardUserPassport' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'login' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'user' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'login' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'login' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'passportString' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DashboardUserPassportQuery, DashboardUserPassportQueryVariables>
export const DashboardSearchUsersDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'DashboardSearchUsers' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'name' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'searchUsers' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'name' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'name' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'entries' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'login' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'social' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'github' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'twitter' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'zhihu' } },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DashboardSearchUsersQuery, DashboardSearchUsersQueryVariables>
export const DashboardAddModeratorDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'DashboardAddModerator' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'user' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'addModerator' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'user' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'user' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'moderators' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'isRoot' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'passportItemCount' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'user' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'login' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DashboardAddModeratorMutation, DashboardAddModeratorMutationVariables>
export const DashboardAddModeratorsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'DashboardAddModerators' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'users' } },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'ListType',
              type: {
                kind: 'NonNullType',
                type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
              },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'addModerators' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'users' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'users' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'moderators' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'isRoot' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'passportItemCount' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'user' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'login' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  DashboardAddModeratorsMutation,
  DashboardAddModeratorsMutationVariables
>
export const UpdateDashboardLayoutDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdateDashboardLayout' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'postLayout' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'DsbPostLayout' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'kanbanLayout' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'DsbKanbanLayout' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'kanbanCardLayout' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'DsbKanbanCardLayout' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'kanbanBoards' } },
          type: {
            kind: 'ListType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'KanbanBoard' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'footerLayout' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'DsbFooterLayout' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'headerLayout' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'DsbHeaderLayout' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'topbarEnabled' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Boolean' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'topbarBg' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'RainbowColor' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'topbarBgCustomColor' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'tagLayout' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'DsbTagLayout' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'inlineTagLayout' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'DsbInlineTagLayout' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'avatarLayout' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'DsbAvatarLayout' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'navActiveLayout' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'DsbNavActiveLayout' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'broadcastEnable' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Boolean' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'kanbanBgColors' } },
          type: {
            kind: 'ListType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'RainbowColor' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'broadcastLayout' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'DsbBroadcastLayout' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'broadcastBg' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'RainbowColor' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'broadcastCustomBg' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'broadcastArticleLayout' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'DsbBroadcastArticleLayout' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'broadcastArticleBg' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'RainbowColor' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'broadcastArticleCustomBg' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'broadcastArticleEnable' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Boolean' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'overlayDark' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Boolean' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'brandLayout' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'DsbBrandLayout' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'communityLayout' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'DsbCommunityLayout' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'changelogLayout' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'DsbChangelogLayout' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'docCoverLayout' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'DsbDocCoverLayout' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'docFaqLayout' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'DsbDocFaqLayout' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updateDashboardLayout' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'postLayout' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'postLayout' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'kanbanLayout' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'kanbanLayout' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'kanbanCardLayout' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'kanbanCardLayout' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'kanbanBoards' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'kanbanBoards' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'footerLayout' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'footerLayout' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'headerLayout' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'headerLayout' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'topbarEnabled' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'topbarEnabled' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'topbarBg' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'topbarBg' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'topbarBgCustomColor' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'topbarBgCustomColor' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'tagLayout' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'tagLayout' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'inlineTagLayout' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'inlineTagLayout' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'avatarLayout' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'avatarLayout' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'navActiveLayout' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'navActiveLayout' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'broadcastEnable' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'broadcastEnable' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'broadcastLayout' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'broadcastLayout' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'broadcastBg' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'broadcastBg' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'broadcastCustomBg' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'broadcastCustomBg' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'broadcastArticleLayout' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'broadcastArticleLayout' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'broadcastArticleBg' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'broadcastArticleBg' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'broadcastArticleCustomBg' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'broadcastArticleCustomBg' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'broadcastArticleEnable' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'broadcastArticleEnable' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'kanbanBgColors' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'kanbanBgColors' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'overlayDark' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'overlayDark' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'brandLayout' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'brandLayout' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'communityLayout' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'communityLayout' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'changelogLayout' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'changelogLayout' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'docCoverLayout' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'docCoverLayout' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'docFaqLayout' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'docFaqLayout' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'layout' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'postLayout' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'kanbanLayout' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'kanbanCardLayout' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'kanbanBoards' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'kanbanBgColors' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'docCoverLayout' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'docFaqLayout' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'tagLayout' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'inlineTagLayout' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'avatarLayout' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'brandLayout' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'communityLayout' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'navActiveLayout' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'topbarEnabled' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'topbarBg' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'topbarBgCustomColor' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'broadcastLayout' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'broadcastBg' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'broadcastCustomBg' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'broadcastEnable' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'broadcastArticleLayout' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'broadcastArticleBg' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'broadcastArticleCustomBg' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'broadcastArticleEnable' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'changelogLayout' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'footerLayout' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'headerLayout' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'overlayDark' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<UpdateDashboardLayoutMutation, UpdateDashboardLayoutMutationVariables>
export const CreateCommunityAssetUploadIntentDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'CreateCommunityAssetUploadIntent' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'file' } },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'CommunityAssetUploadFileInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'createCommunityAssetUploadIntent' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'file' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'file' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'uploadRef' } },
                { kind: 'Field', name: { kind: 'Name', value: 'assetPublicRef' } },
                { kind: 'Field', name: { kind: 'Name', value: 'objectKey' } },
                { kind: 'Field', name: { kind: 'Name', value: 'capability' } },
                { kind: 'Field', name: { kind: 'Name', value: 'expiresAt' } },
                { kind: 'Field', name: { kind: 'Name', value: 'maxSizeBytes' } },
                { kind: 'Field', name: { kind: 'Name', value: 'allowedMimeTypes' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  CreateCommunityAssetUploadIntentMutation,
  CreateCommunityAssetUploadIntentMutationVariables
>
export const PagedCommunityAssetsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'PagedCommunityAssets' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'filter' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'CommunityAssetFilter' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pagedCommunityAssets' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'filter' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'filter' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'entries' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'publicRef' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'assetType' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'filename' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'mimeType' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'sizeBytes' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'storage' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'storageKey' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'contentHash' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'width' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'height' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'uploader' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'login' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
                          ],
                        },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'deletedAt' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
                    ],
                  },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'pageNumber' } },
                { kind: 'Field', name: { kind: 'Name', value: 'pageSize' } },
                { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
                { kind: 'Field', name: { kind: 'Name', value: 'totalPages' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PagedCommunityAssetsQuery, PagedCommunityAssetsQueryVariables>
export const CommunityAssetStatsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'CommunityAssetStats' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'filter' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'CommunityAssetFilter' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'communityAssetStats' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'filter' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'filter' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
                { kind: 'Field', name: { kind: 'Name', value: 'storageBytes' } },
                { kind: 'Field', name: { kind: 'Name', value: 'storageLimitBytes' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'byThread' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'count' } },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'byAssetType' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'assetType' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'count' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'subtypes' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'key' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'label' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'count' } },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CommunityAssetStatsQuery, CommunityAssetStatsQueryVariables>
export const CommunityAssetRefsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'CommunityAssetRefs' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'assetId' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'filter' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'PagiFilter' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'communityAssetRefs' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'assetId' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'assetId' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'filter' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'filter' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'entries' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'articleId' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'usage' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'blockId' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'blockType' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'position' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'alt' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'source' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
                    ],
                  },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'pageNumber' } },
                { kind: 'Field', name: { kind: 'Name', value: 'pageSize' } },
                { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
                { kind: 'Field', name: { kind: 'Name', value: 'totalPages' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CommunityAssetRefsQuery, CommunityAssetRefsQueryVariables>
export const DeleteCommunityAssetDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'DeleteCommunityAsset' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'deleteCommunityAsset' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'publicRef' } },
                { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                { kind: 'Field', name: { kind: 'Name', value: 'deletedAt' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DeleteCommunityAssetMutation, DeleteCommunityAssetMutationVariables>
export const DashboardTrashedPostsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'DashboardTrashedPosts' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'page' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'size' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'trashedArticles' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'thread' },
                value: { kind: 'EnumValue', value: 'POST' },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'filter' },
                value: {
                  kind: 'ObjectValue',
                  fields: [
                    {
                      kind: 'ObjectField',
                      name: { kind: 'Name', value: 'page' },
                      value: { kind: 'Variable', name: { kind: 'Name', value: 'page' } },
                    },
                    {
                      kind: 'ObjectField',
                      name: { kind: 'Name', value: 'size' },
                      value: { kind: 'Variable', name: { kind: 'Name', value: 'size' } },
                    },
                  ],
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'entries' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'articleRef' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'deletedAt' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'scheduledPermanentDeletionAt' },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'mentionedByCount' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'deletedBy' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'FragmentSpread',
                              name: { kind: 'Name', value: 'DashboardAuthorFields' },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'article' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'views' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'upvotesCount' } },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'meta' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
                                ],
                              },
                            },
                            {
                              kind: 'InlineFragment',
                              typeCondition: {
                                kind: 'NamedType',
                                name: { kind: 'Name', value: 'Post' },
                              },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  { kind: 'Field', name: { kind: 'Name', value: 'cat' } },
                                  { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                                  { kind: 'Field', name: { kind: 'Name', value: 'commentsCount' } },
                                  { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
                                  { kind: 'Field', name: { kind: 'Name', value: 'activeAt' } },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'author' },
                                    selectionSet: {
                                      kind: 'SelectionSet',
                                      selections: [
                                        {
                                          kind: 'FragmentSpread',
                                          name: { kind: 'Name', value: 'DashboardAuthorFields' },
                                        },
                                      ],
                                    },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'communityTags' },
                                    selectionSet: {
                                      kind: 'SelectionSet',
                                      selections: [
                                        {
                                          kind: 'FragmentSpread',
                                          name: { kind: 'Name', value: 'DashboardTagFields' },
                                        },
                                      ],
                                    },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'DashboardTrashedArticlesPageInfo' },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardAuthorFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'User' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardTagFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommunityTag' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'layout' } },
          { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
          { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
          { kind: 'Field', name: { kind: 'Name', value: 'color' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
          { kind: 'Field', name: { kind: 'Name', value: 'group' } },
          { kind: 'Field', name: { kind: 'Name', value: 'groupId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'slug' } }],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardTrashedArticlesPageInfo' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'PagedTrashedArticles' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageSize' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalPages' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageNumber' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DashboardTrashedPostsQuery, DashboardTrashedPostsQueryVariables>
export const RestoreTrashedPostDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'restoreTrashedPost' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'restoreTrashedArticle' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'thread' },
                value: { kind: 'EnumValue', value: 'POST' },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'title' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<RestoreTrashedPostMutation, RestoreTrashedPostMutationVariables>
export const PermanentlyDeleteTrashedPostDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'permanentlyDeleteTrashedPost' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'permanentlyDeleteTrashedArticle' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'thread' },
                value: { kind: 'EnumValue', value: 'POST' },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'done' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  PermanentlyDeleteTrashedPostMutation,
  PermanentlyDeleteTrashedPostMutationVariables
>
export const DashboardDocTreeDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'DashboardDocTree' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'docTree' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'revision' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'treeState' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'hasUnpublishedChanges' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'stagedEventCount' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'baseSnapshotId' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'latestSnapshotId' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'latestReleaseId' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'latestReleaseNumber' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'revision' } },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'stagedEvents' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'seq' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'eventType' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'payload' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'inversePayload' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'tabs' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'DashboardDocTreeNodeFields' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'pins' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'FragmentSpread',
                              name: { kind: 'Name', value: 'DashboardDocTreeNodeFields' },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'groups' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'FragmentSpread',
                              name: { kind: 'Name', value: 'DashboardDocTreeGroupFields' },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardDocTreeNodeFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DocTreeNode' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'parentNodeId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'docId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'type' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          { kind: 'Field', name: { kind: 'Name', value: 'href' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'appearance' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'light' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bg' } },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'dark' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bg' } },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'badge' } },
          { kind: 'Field', name: { kind: 'Name', value: 'hidden' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'publishState' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                { kind: 'Field', name: { kind: 'Name', value: 'published' } },
                { kind: 'Field', name: { kind: 'Name', value: 'publishedBefore' } },
                { kind: 'Field', name: { kind: 'Name', value: 'hasDraft' } },
                { kind: 'Field', name: { kind: 'Name', value: 'publicNodeId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'publicDocId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'hasUnpublishedChanges' } },
                { kind: 'Field', name: { kind: 'Name', value: 'lastPublishedAt' } },
                { kind: 'Field', name: { kind: 'Name', value: 'inCover' } },
                { kind: 'Field', name: { kind: 'Name', value: 'hiddenFromCover' } },
                { kind: 'Field', name: { kind: 'Name', value: 'pinnedToCover' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardDocTreeChildFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DocTreeNode' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'FragmentSpread', name: { kind: 'Name', value: 'DashboardDocTreeNodeFields' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pages' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'DashboardDocTreeNodeFields' },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardDocTreeGroupFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DocTreeNode' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'FragmentSpread', name: { kind: 'Name', value: 'DashboardDocTreeNodeFields' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pages' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'DashboardDocTreeChildFields' },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DashboardDocTreeQuery, DashboardDocTreeQueryVariables>
export const DashboardDocPublishChecklistDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'DashboardDocPublishChecklist' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'docPublishChecklist' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'docChanges' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'DashboardDocPublishChecklistItemFields' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'treeChanges' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'DashboardDocPublishChecklistItemFields' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardDocPublishChecklistItemFields' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'DocPublishChecklistItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'action' } },
          { kind: 'Field', name: { kind: 'Name', value: 'selectedByDefault' } },
          { kind: 'Field', name: { kind: 'Name', value: 'selectable' } },
          { kind: 'Field', name: { kind: 'Name', value: 'disabledReason' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  DashboardDocPublishChecklistQuery,
  DashboardDocPublishChecklistQueryVariables
>
export const DocTreeTrashItemsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'docTreeTrashItems' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'docTreeTrashItems' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'nodeId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'docId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                { kind: 'Field', name: { kind: 'Name', value: 'deletedFromParentNodeId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'deletedFromIndex' } },
                { kind: 'Field', name: { kind: 'Name', value: 'deletedAt' } },
                { kind: 'Field', name: { kind: 'Name', value: 'restoredAt' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DocTreeTrashItemsQuery, DocTreeTrashItemsQueryVariables>
export const DocDraftDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'docDraft' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'docDraft' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'docId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                { kind: 'Field', name: { kind: 'Name', value: 'subtitle' } },
                { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
                { kind: 'Field', name: { kind: 'Name', value: 'stage' } },
                { kind: 'Field', name: { kind: 'Name', value: 'digest' } },
                { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
                { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'author' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'login' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'document' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'json' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'markdown' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'markdownToc' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'html' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DocDraftQuery, DocDraftQueryVariables>
export const DocDraftSnapshotsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'docDraftSnapshots' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'stage' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'ArticleSnapshotStage' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'docDraftSnapshots' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'stage' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'stage' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
                { kind: 'Field', name: { kind: 'Name', value: 'stage' } },
                { kind: 'Field', name: { kind: 'Name', value: 'action' } },
                { kind: 'Field', name: { kind: 'Name', value: 'articleHashId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
                { kind: 'Field', name: { kind: 'Name', value: 'subtitle' } },
                { kind: 'Field', name: { kind: 'Name', value: 'digest' } },
                { kind: 'Field', name: { kind: 'Name', value: 'documentJson' } },
                { kind: 'Field', name: { kind: 'Name', value: 'versionHash' } },
                { kind: 'Field', name: { kind: 'Name', value: 'revisionNumber' } },
                { kind: 'Field', name: { kind: 'Name', value: 'schemaVersion' } },
                { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'author' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'login' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DocDraftSnapshotsQuery, DocDraftSnapshotsQueryVariables>
export const CreateDocTreeNodeDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'CreateDocTreeNode' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'baseRevision' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'parentNodeId' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'input' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'DocTreeNodeInput' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'createDocTreeNode' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'baseRevision' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'baseRevision' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'parentNodeId' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'parentNodeId' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'input' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'DashboardDocTreeMutationPayload' },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardDocTreeNodeFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DocTreeNode' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'parentNodeId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'docId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'type' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          { kind: 'Field', name: { kind: 'Name', value: 'href' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'appearance' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'light' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bg' } },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'dark' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bg' } },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'badge' } },
          { kind: 'Field', name: { kind: 'Name', value: 'hidden' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'publishState' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                { kind: 'Field', name: { kind: 'Name', value: 'published' } },
                { kind: 'Field', name: { kind: 'Name', value: 'publishedBefore' } },
                { kind: 'Field', name: { kind: 'Name', value: 'hasDraft' } },
                { kind: 'Field', name: { kind: 'Name', value: 'publicNodeId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'publicDocId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'hasUnpublishedChanges' } },
                { kind: 'Field', name: { kind: 'Name', value: 'lastPublishedAt' } },
                { kind: 'Field', name: { kind: 'Name', value: 'inCover' } },
                { kind: 'Field', name: { kind: 'Name', value: 'hiddenFromCover' } },
                { kind: 'Field', name: { kind: 'Name', value: 'pinnedToCover' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardDocTreeMutationPayload' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DocTreeMutationPayload' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'revision' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'treeState' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'hasUnpublishedChanges' } },
                { kind: 'Field', name: { kind: 'Name', value: 'stagedEventCount' } },
                { kind: 'Field', name: { kind: 'Name', value: 'baseSnapshotId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'latestSnapshotId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'latestReleaseId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'latestReleaseNumber' } },
                { kind: 'Field', name: { kind: 'Name', value: 'revision' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'conflict' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'node' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'DashboardDocTreeNodeFields' },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'affectedNodes' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'DashboardDocTreeNodeFields' },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CreateDocTreeNodeMutation, CreateDocTreeNodeMutationVariables>
export const UpdateDocTreeNodeDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdateDocTreeNode' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'baseRevision' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'patch' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'DocTreeNodePatchInput' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updateDocTreeNode' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'baseRevision' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'baseRevision' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'patch' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'patch' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'DashboardDocTreeMutationPayload' },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardDocTreeNodeFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DocTreeNode' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'parentNodeId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'docId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'type' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          { kind: 'Field', name: { kind: 'Name', value: 'href' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'appearance' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'light' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bg' } },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'dark' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bg' } },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'badge' } },
          { kind: 'Field', name: { kind: 'Name', value: 'hidden' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'publishState' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                { kind: 'Field', name: { kind: 'Name', value: 'published' } },
                { kind: 'Field', name: { kind: 'Name', value: 'publishedBefore' } },
                { kind: 'Field', name: { kind: 'Name', value: 'hasDraft' } },
                { kind: 'Field', name: { kind: 'Name', value: 'publicNodeId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'publicDocId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'hasUnpublishedChanges' } },
                { kind: 'Field', name: { kind: 'Name', value: 'lastPublishedAt' } },
                { kind: 'Field', name: { kind: 'Name', value: 'inCover' } },
                { kind: 'Field', name: { kind: 'Name', value: 'hiddenFromCover' } },
                { kind: 'Field', name: { kind: 'Name', value: 'pinnedToCover' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardDocTreeMutationPayload' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DocTreeMutationPayload' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'revision' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'treeState' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'hasUnpublishedChanges' } },
                { kind: 'Field', name: { kind: 'Name', value: 'stagedEventCount' } },
                { kind: 'Field', name: { kind: 'Name', value: 'baseSnapshotId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'latestSnapshotId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'latestReleaseId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'latestReleaseNumber' } },
                { kind: 'Field', name: { kind: 'Name', value: 'revision' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'conflict' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'node' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'DashboardDocTreeNodeFields' },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'affectedNodes' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'DashboardDocTreeNodeFields' },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<UpdateDocTreeNodeMutation, UpdateDocTreeNodeMutationVariables>
export const UpdateDocDraftDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdateDocDraft' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'title' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'subtitle' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'slug' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'bodyBag' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'ArtimentBodyBagInput' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updateDocDraft' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'title' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'title' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'subtitle' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'subtitle' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'slug' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'slug' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'bodyBag' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'bodyBag' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'docId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                { kind: 'Field', name: { kind: 'Name', value: 'subtitle' } },
                { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
                { kind: 'Field', name: { kind: 'Name', value: 'digest' } },
                { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
                { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'author' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'login' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'document' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'json' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'markdown' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'markdownToc' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'html' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<UpdateDocDraftMutation, UpdateDocDraftMutationVariables>
export const CheckpointDocDraftSnapshotDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'checkpointDocDraftSnapshot' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'checkpointDocDraftSnapshot' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
                { kind: 'Field', name: { kind: 'Name', value: 'stage' } },
                { kind: 'Field', name: { kind: 'Name', value: 'action' } },
                { kind: 'Field', name: { kind: 'Name', value: 'articleHashId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
                { kind: 'Field', name: { kind: 'Name', value: 'subtitle' } },
                { kind: 'Field', name: { kind: 'Name', value: 'documentJson' } },
                { kind: 'Field', name: { kind: 'Name', value: 'digest' } },
                { kind: 'Field', name: { kind: 'Name', value: 'versionHash' } },
                { kind: 'Field', name: { kind: 'Name', value: 'revisionNumber' } },
                { kind: 'Field', name: { kind: 'Name', value: 'schemaVersion' } },
                { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'author' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'login' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  CheckpointDocDraftSnapshotMutation,
  CheckpointDocDraftSnapshotMutationVariables
>
export const PublishDocChangesDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'publishDocChanges' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'input' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'DocPublishChangesInput' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'mode' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'DocPublishMode' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'publishDocChanges' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'input' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'mode' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'mode' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'done' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'release' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'releaseNumber' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'publishedAt' } },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'checklist' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'docChanges' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'FragmentSpread',
                              name: {
                                kind: 'Name',
                                value: 'DashboardDocPublishChecklistItemFields',
                              },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'treeChanges' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'FragmentSpread',
                              name: {
                                kind: 'Name',
                                value: 'DashboardDocPublishChecklistItemFields',
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardDocPublishChecklistItemFields' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'DocPublishChecklistItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'action' } },
          { kind: 'Field', name: { kind: 'Name', value: 'selectedByDefault' } },
          { kind: 'Field', name: { kind: 'Name', value: 'selectable' } },
          { kind: 'Field', name: { kind: 'Name', value: 'disabledReason' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PublishDocChangesMutation, PublishDocChangesMutationVariables>
export const MoveDocToDraftDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'moveDocToDraft' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'moveDocToDraft' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'docId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'stage' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'publishState' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'published' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'publishedBefore' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'hasDraft' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'publicNodeId' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'publicDocId' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'hasUnpublishedChanges' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'lastPublishedAt' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'inCover' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'hiddenFromCover' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'pinnedToCover' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<MoveDocToDraftMutation, MoveDocToDraftMutationVariables>
export const MoveDocTreeSubtreeToDraftDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'moveDocTreeSubtreeToDraft' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'nodeId' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'moveDocTreeSubtreeToDraft' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'nodeId' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'nodeId' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'done' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  MoveDocTreeSubtreeToDraftMutation,
  MoveDocTreeSubtreeToDraftMutationVariables
>
export const RestoreDocDraftSnapshotDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'restoreDocDraftSnapshot' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'snapshotId' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'restoreDocDraftSnapshot' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'snapshotId' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'snapshotId' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                { kind: 'Field', name: { kind: 'Name', value: 'subtitle' } },
                { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
                { kind: 'Field', name: { kind: 'Name', value: 'digest' } },
                { kind: 'Field', name: { kind: 'Name', value: 'insertedAt' } },
                { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'author' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'login' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'document' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'json' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'markdown' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'markdownToc' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'html' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  RestoreDocDraftSnapshotMutation,
  RestoreDocDraftSnapshotMutationVariables
>
export const DeleteDocTreeNodeDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'DeleteDocTreeNode' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'baseRevision' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'deleteDocTreeNode' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'baseRevision' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'baseRevision' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'DashboardDocTreeMutationPayload' },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardDocTreeNodeFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DocTreeNode' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'parentNodeId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'docId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'type' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          { kind: 'Field', name: { kind: 'Name', value: 'href' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'appearance' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'light' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bg' } },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'dark' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bg' } },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'badge' } },
          { kind: 'Field', name: { kind: 'Name', value: 'hidden' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'publishState' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                { kind: 'Field', name: { kind: 'Name', value: 'published' } },
                { kind: 'Field', name: { kind: 'Name', value: 'publishedBefore' } },
                { kind: 'Field', name: { kind: 'Name', value: 'hasDraft' } },
                { kind: 'Field', name: { kind: 'Name', value: 'publicNodeId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'publicDocId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'hasUnpublishedChanges' } },
                { kind: 'Field', name: { kind: 'Name', value: 'lastPublishedAt' } },
                { kind: 'Field', name: { kind: 'Name', value: 'inCover' } },
                { kind: 'Field', name: { kind: 'Name', value: 'hiddenFromCover' } },
                { kind: 'Field', name: { kind: 'Name', value: 'pinnedToCover' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardDocTreeMutationPayload' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DocTreeMutationPayload' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'revision' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'treeState' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'hasUnpublishedChanges' } },
                { kind: 'Field', name: { kind: 'Name', value: 'stagedEventCount' } },
                { kind: 'Field', name: { kind: 'Name', value: 'baseSnapshotId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'latestSnapshotId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'latestReleaseId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'latestReleaseNumber' } },
                { kind: 'Field', name: { kind: 'Name', value: 'revision' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'conflict' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'node' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'DashboardDocTreeNodeFields' },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'affectedNodes' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'DashboardDocTreeNodeFields' },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DeleteDocTreeNodeMutation, DeleteDocTreeNodeMutationVariables>
export const RestoreDocTreeTrashItemDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'RestoreDocTreeTrashItem' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'baseRevision' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'targetParentNodeId' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'targetIndex' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'restoreDocTreeTrashItem' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'baseRevision' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'baseRevision' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'targetParentNodeId' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'targetParentNodeId' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'targetIndex' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'targetIndex' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'DashboardDocTreeMutationPayload' },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardDocTreeNodeFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DocTreeNode' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'parentNodeId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'docId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'type' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          { kind: 'Field', name: { kind: 'Name', value: 'href' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'appearance' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'light' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bg' } },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'dark' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bg' } },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'badge' } },
          { kind: 'Field', name: { kind: 'Name', value: 'hidden' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'publishState' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                { kind: 'Field', name: { kind: 'Name', value: 'published' } },
                { kind: 'Field', name: { kind: 'Name', value: 'publishedBefore' } },
                { kind: 'Field', name: { kind: 'Name', value: 'hasDraft' } },
                { kind: 'Field', name: { kind: 'Name', value: 'publicNodeId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'publicDocId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'hasUnpublishedChanges' } },
                { kind: 'Field', name: { kind: 'Name', value: 'lastPublishedAt' } },
                { kind: 'Field', name: { kind: 'Name', value: 'inCover' } },
                { kind: 'Field', name: { kind: 'Name', value: 'hiddenFromCover' } },
                { kind: 'Field', name: { kind: 'Name', value: 'pinnedToCover' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardDocTreeMutationPayload' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DocTreeMutationPayload' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'revision' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'treeState' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'hasUnpublishedChanges' } },
                { kind: 'Field', name: { kind: 'Name', value: 'stagedEventCount' } },
                { kind: 'Field', name: { kind: 'Name', value: 'baseSnapshotId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'latestSnapshotId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'latestReleaseId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'latestReleaseNumber' } },
                { kind: 'Field', name: { kind: 'Name', value: 'revision' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'conflict' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'node' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'DashboardDocTreeNodeFields' },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'affectedNodes' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'DashboardDocTreeNodeFields' },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  RestoreDocTreeTrashItemMutation,
  RestoreDocTreeTrashItemMutationVariables
>
export const DuplicateDocTreeNodeDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'DuplicateDocTreeNode' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'baseRevision' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'duplicateDocTreeNode' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'baseRevision' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'baseRevision' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'DashboardDocTreeMutationPayload' },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardDocTreeNodeFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DocTreeNode' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'parentNodeId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'docId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'type' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          { kind: 'Field', name: { kind: 'Name', value: 'href' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'appearance' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'light' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bg' } },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'dark' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bg' } },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'badge' } },
          { kind: 'Field', name: { kind: 'Name', value: 'hidden' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'publishState' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                { kind: 'Field', name: { kind: 'Name', value: 'published' } },
                { kind: 'Field', name: { kind: 'Name', value: 'publishedBefore' } },
                { kind: 'Field', name: { kind: 'Name', value: 'hasDraft' } },
                { kind: 'Field', name: { kind: 'Name', value: 'publicNodeId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'publicDocId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'hasUnpublishedChanges' } },
                { kind: 'Field', name: { kind: 'Name', value: 'lastPublishedAt' } },
                { kind: 'Field', name: { kind: 'Name', value: 'inCover' } },
                { kind: 'Field', name: { kind: 'Name', value: 'hiddenFromCover' } },
                { kind: 'Field', name: { kind: 'Name', value: 'pinnedToCover' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardDocTreeMutationPayload' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DocTreeMutationPayload' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'revision' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'treeState' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'hasUnpublishedChanges' } },
                { kind: 'Field', name: { kind: 'Name', value: 'stagedEventCount' } },
                { kind: 'Field', name: { kind: 'Name', value: 'baseSnapshotId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'latestSnapshotId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'latestReleaseId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'latestReleaseNumber' } },
                { kind: 'Field', name: { kind: 'Name', value: 'revision' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'conflict' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'node' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'DashboardDocTreeNodeFields' },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'affectedNodes' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'DashboardDocTreeNodeFields' },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DuplicateDocTreeNodeMutation, DuplicateDocTreeNodeMutationVariables>
export const MoveDocTreeNodeDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'MoveDocTreeNode' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'baseRevision' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'targetParentNodeId' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'targetIndex' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'moveDocTreeNode' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'baseRevision' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'baseRevision' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'targetParentNodeId' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'targetParentNodeId' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'targetIndex' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'targetIndex' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'DashboardDocTreeMutationPayload' },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardDocTreeNodeFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DocTreeNode' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'parentNodeId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'docId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'type' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          { kind: 'Field', name: { kind: 'Name', value: 'href' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'appearance' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'light' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bg' } },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'dark' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bg' } },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'badge' } },
          { kind: 'Field', name: { kind: 'Name', value: 'hidden' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'publishState' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                { kind: 'Field', name: { kind: 'Name', value: 'published' } },
                { kind: 'Field', name: { kind: 'Name', value: 'publishedBefore' } },
                { kind: 'Field', name: { kind: 'Name', value: 'hasDraft' } },
                { kind: 'Field', name: { kind: 'Name', value: 'publicNodeId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'publicDocId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'hasUnpublishedChanges' } },
                { kind: 'Field', name: { kind: 'Name', value: 'lastPublishedAt' } },
                { kind: 'Field', name: { kind: 'Name', value: 'inCover' } },
                { kind: 'Field', name: { kind: 'Name', value: 'hiddenFromCover' } },
                { kind: 'Field', name: { kind: 'Name', value: 'pinnedToCover' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardDocTreeMutationPayload' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DocTreeMutationPayload' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'revision' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'treeState' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'hasUnpublishedChanges' } },
                { kind: 'Field', name: { kind: 'Name', value: 'stagedEventCount' } },
                { kind: 'Field', name: { kind: 'Name', value: 'baseSnapshotId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'latestSnapshotId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'latestReleaseId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'latestReleaseNumber' } },
                { kind: 'Field', name: { kind: 'Name', value: 'revision' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'conflict' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'node' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'DashboardDocTreeNodeFields' },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'affectedNodes' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'DashboardDocTreeNodeFields' },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<MoveDocTreeNodeMutation, MoveDocTreeNodeMutationVariables>
export const AddDocCoverCardDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'addDocCoverCard' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'groupNodeId' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'addDocCoverCard' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'groupNodeId' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'groupNodeId' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'index' } },
                { kind: 'Field', name: { kind: 'Name', value: 'appearance' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<AddDocCoverCardMutation, AddDocCoverCardMutationVariables>
export const RemoveDocCoverCardDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'removeDocCoverCard' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'groupNodeId' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'removeDocCoverCard' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'groupNodeId' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'groupNodeId' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'index' } },
                { kind: 'Field', name: { kind: 'Name', value: 'appearance' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<RemoveDocCoverCardMutation, RemoveDocCoverCardMutationVariables>
export const ReorderDocCoverCardsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'reorderDocCoverCards' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'ids' } },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'ListType',
              type: {
                kind: 'NonNullType',
                type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
              },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'reorderDocCoverCards' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'ids' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'ids' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'done' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<ReorderDocCoverCardsMutation, ReorderDocCoverCardsMutationVariables>
export const PinDocToCoverDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'pinDocToCover' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'nodeId' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pinDocToCover' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'nodeId' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'nodeId' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'nodeId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'index' } },
                { kind: 'Field', name: { kind: 'Name', value: 'appearance' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PinDocToCoverMutation, PinDocToCoverMutationVariables>
export const UnpinDocFromCoverDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'unpinDocFromCover' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'nodeId' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'unpinDocFromCover' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'nodeId' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'nodeId' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'nodeId' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<UnpinDocFromCoverMutation, UnpinDocFromCoverMutationVariables>
export const ReorderDocCoverPinnedDocsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'reorderDocCoverPinnedDocs' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'nodeIds' } },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'ListType',
              type: {
                kind: 'NonNullType',
                type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
              },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'reorderDocCoverPinnedDocs' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'nodeIds' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'nodeIds' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'done' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  ReorderDocCoverPinnedDocsMutation,
  ReorderDocCoverPinnedDocsMutationVariables
>
export const UpdateDocCoverCardAppearanceDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'updateDocCoverCardAppearance' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'appearance' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Json' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updateDocCoverCardAppearance' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'appearance' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'appearance' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'appearance' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  UpdateDocCoverCardAppearanceMutation,
  UpdateDocCoverCardAppearanceMutationVariables
>
export const UpdatePinnedDocAppearanceDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'updatePinnedDocAppearance' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'nodeId' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'appearance' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Json' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updatePinnedDocAppearance' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'nodeId' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'nodeId' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'appearance' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'appearance' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'nodeId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'appearance' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  UpdatePinnedDocAppearanceMutation,
  UpdatePinnedDocAppearanceMutationVariables
>
export const DashboardPressConfigDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'DashboardPressConfig' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pressConfig' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'markdownEnabled' } },
                { kind: 'Field', name: { kind: 'Name', value: 'feedEnabled' } },
                { kind: 'Field', name: { kind: 'Name', value: 'feedType' } },
                { kind: 'Field', name: { kind: 'Name', value: 'feedCount' } },
                { kind: 'Field', name: { kind: 'Name', value: 'feedThreads' } },
                { kind: 'Field', name: { kind: 'Name', value: 'llmsEnabled' } },
                { kind: 'Field', name: { kind: 'Name', value: 'sitemapEnabled' } },
                { kind: 'Field', name: { kind: 'Name', value: 'revision' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DashboardPressConfigQuery, DashboardPressConfigQueryVariables>
export const UpdateDashboardPressConfigDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdateDashboardPressConfig' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'input' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'UpdatePressConfigInput' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updatePressConfig' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'input' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'config' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'markdownEnabled' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'feedEnabled' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'feedType' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'feedCount' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'feedThreads' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'llmsEnabled' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'sitemapEnabled' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'revision' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  UpdateDashboardPressConfigMutation,
  UpdateDashboardPressConfigMutationVariables
>
export const DashboardThirdPartyAnalyticsProvidersDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'DashboardThirdPartyAnalyticsProviders' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'thirdPartyAnalyticsProviders' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
                { kind: 'Field', name: { kind: 'Name', value: 'detail' } },
                { kind: 'Field', name: { kind: 'Name', value: 'docsUrl' } },
                { kind: 'Field', name: { kind: 'Name', value: 'icon' } },
                { kind: 'Field', name: { kind: 'Name', value: 'identityField' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'configFields' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'key' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'label' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'placeholder' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'requiredWhenEnabled' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'pattern' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  DashboardThirdPartyAnalyticsProvidersQuery,
  DashboardThirdPartyAnalyticsProvidersQueryVariables
>
export const DashboardOpenGraphInfoDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'DashboardOpenGraphInfo' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'url' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'openGraphInfo' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'url' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'url' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                { kind: 'Field', name: { kind: 'Name', value: 'favicon' } },
                { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                { kind: 'Field', name: { kind: 'Name', value: 'siteName' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DashboardOpenGraphInfoQuery, DashboardOpenGraphInfoQueryVariables>
export const UpdateDashboardBaseInfoDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdateDashboardBaseInfo' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'homepage' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'title' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'slug' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'desc' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'locale' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'introduction' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'logo' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'favicon' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'city' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'techstack' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updateDashboardBaseInfo' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'homepage' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'homepage' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'title' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'title' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'slug' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'slug' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'desc' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'desc' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'locale' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'locale' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'introduction' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'introduction' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'logo' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'logo' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'favicon' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'favicon' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'city' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'city' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'techstack' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'techstack' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'baseInfo' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'logo' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'favicon' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'locale' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  UpdateDashboardBaseInfoMutation,
  UpdateDashboardBaseInfoMutationVariables
>
export const UpdateDashboardMediaReportsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdateDashboardMediaReports' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'mediaReports' } },
          type: {
            kind: 'ListType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'DsbMediaReportMap' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updateDashboardMediaReports' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'mediaReports' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'mediaReports' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'mediaReports' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'index' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'favicon' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'siteName' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  UpdateDashboardMediaReportsMutation,
  UpdateDashboardMediaReportsMutationVariables
>
export const UpdateDashboardThirdPartyAnalyticsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdateDashboardThirdPartyAnalytics' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'thirdPartyAnalytics' } },
          type: {
            kind: 'ListType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'DsbThirdPartyAnalyticsInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updateDashboardThirdPartyAnalytics' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'thirdPartyAnalytics' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'thirdPartyAnalytics' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'thirdPartyAnalytics' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'DashboardThirdPartyAnalyticsFields' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardThirdPartyAnalyticsFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DsbThirdPartyAnalytics' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
          { kind: 'Field', name: { kind: 'Name', value: 'enabled' } },
          { kind: 'Field', name: { kind: 'Name', value: 'measurementId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'containerId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'projectId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'domain' } },
          { kind: 'Field', name: { kind: 'Name', value: 'siteId' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  UpdateDashboardThirdPartyAnalyticsMutation,
  UpdateDashboardThirdPartyAnalyticsMutationVariables
>
export const UpdateDashboardSeoDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdateDashboardSeo' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'seoEnable' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Boolean' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'ogSiteName' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'ogTitle' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'ogDescription' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'ogUrl' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'ogImage' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'ogLocale' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'ogPublisher' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'twTitle' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'twDescription' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'twUrl' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'twCard' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'twSite' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'twImage' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'twImageWidth' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'twImageHeight' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updateDashboardSeo' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'seoEnable' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'seoEnable' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'ogSiteName' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'ogSiteName' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'ogTitle' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'ogTitle' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'ogDescription' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'ogDescription' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'ogUrl' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'ogUrl' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'ogImage' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'ogImage' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'ogLocale' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'ogLocale' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'ogPublisher' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'ogPublisher' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'twTitle' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'twTitle' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'twDescription' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'twDescription' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'twUrl' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'twUrl' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'twCard' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'twCard' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'twSite' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'twSite' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'twImage' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'twImage' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'twImageWidth' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'twImageWidth' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'twImageHeight' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'twImageHeight' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'seo' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [{ kind: 'Field', name: { kind: 'Name', value: 'seoEnable' } }],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<UpdateDashboardSeoMutation, UpdateDashboardSeoMutationVariables>
export const UpdateDashboardEnableDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdateDashboardEnable' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'post' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Boolean' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'changelog' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Boolean' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'about' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Boolean' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updateDashboardEnable' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'post' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'post' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'changelog' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'changelog' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'about' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'about' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'enable' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'post' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'changelog' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'about' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<UpdateDashboardEnableMutation, UpdateDashboardEnableMutationVariables>
export const UpdateDashboardSocialLinksDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdateDashboardSocialLinks' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'socialLinks' } },
          type: {
            kind: 'ListType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'DsbSocialLinkMap' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updateDashboardSocialLinks' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'socialLinks' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'socialLinks' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'socialLinks' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'link' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  UpdateDashboardSocialLinksMutation,
  UpdateDashboardSocialLinksMutationVariables
>
export const UpdateDashboardNameAliasDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdateDashboardNameAlias' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'nameAlias' } },
          type: {
            kind: 'ListType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'DsbAliasMap' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updateDashboardNameAlias' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'nameAlias' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'nameAlias' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'nameAlias' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'original' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'group' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  UpdateDashboardNameAliasMutation,
  UpdateDashboardNameAliasMutationVariables
>
export const UpdateDashboardDocFaqDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdateDashboardDocFaq' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'docFaq' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'DsbDocFaqInput' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updateDashboardDocFaq' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'docFaq' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'docFaq' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'docFaq' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'groupedView' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'groupItems' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'index' } },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'items' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                                  { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                                  { kind: 'Field', name: { kind: 'Name', value: 'detail' } },
                                  { kind: 'Field', name: { kind: 'Name', value: 'index' } },
                                ],
                              },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'flatItems' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'detail' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'index' } },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<UpdateDashboardDocFaqMutation, UpdateDashboardDocFaqMutationVariables>
export const UpdateDashboardHeaderLinksDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdateDashboardHeaderLinks' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'headerLinks' } },
          type: {
            kind: 'ListType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'DsbLinkMap' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updateDashboardHeaderLinks' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'headerLinks' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'headerLinks' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'headerLinks' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'DashboardHeaderLinkFields' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardHeaderLinkFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DsbLink' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'type' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'url' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'links' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                { kind: 'Field', name: { kind: 'Name', value: 'url' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  UpdateDashboardHeaderLinksMutation,
  UpdateDashboardHeaderLinksMutationVariables
>
export const UpdateDashboardFooterLinksDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdateDashboardFooterLinks' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'footerLinks' } },
          type: {
            kind: 'ListType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'DsbLinkMap' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updateDashboardFooterLinks' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'footerLinks' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'footerLinks' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'footerLinks' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'DashboardHeaderLinkFields' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardHeaderLinkFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DsbLink' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'type' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'url' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'links' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                { kind: 'Field', name: { kind: 'Name', value: 'url' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  UpdateDashboardFooterLinksMutation,
  UpdateDashboardFooterLinksMutationVariables
>
export const UpdateDashboardFooterOnelineLinksDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdateDashboardFooterOnelineLinks' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'footerOnelineLinks' } },
          type: {
            kind: 'ListType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'DsbLinkChildMap' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updateDashboardFooterOnelineLinks' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'footerOnelineLinks' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'footerOnelineLinks' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'footerOnelineLinks' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'DashboardFooterOnelineLinkFields' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardFooterOnelineLinkFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DsbLinkChild' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'url' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  UpdateDashboardFooterOnelineLinksMutation,
  UpdateDashboardFooterOnelineLinksMutationVariables
>
export const DashboardCommunityBaseInfoDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'DashboardCommunityBaseInfo' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'slug' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'incViews' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Boolean' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'slug' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'slug' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'incViews' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'incViews' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'dashboard' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'baseInfo' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'locale' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'favicon' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'logo' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'introduction' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'homepage' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'city' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'techstack' } },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'mediaReports' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'siteName' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'favicon' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'index' } },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  DashboardCommunityBaseInfoQuery,
  DashboardCommunityBaseInfoQueryVariables
>
export const DashboardCommunitySocialLinksDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'DashboardCommunitySocialLinks' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'slug' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'incViews' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Boolean' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'slug' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'slug' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'incViews' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'incViews' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'dashboard' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'socialLinks' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'link' } },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  DashboardCommunitySocialLinksQuery,
  DashboardCommunitySocialLinksQueryVariables
>
export const DashboardCommunityOverviewDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'DashboardCommunityOverview' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'slug' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'incViews' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Boolean' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'slug' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'slug' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'incViews' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'incViews' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'views' } },
                { kind: 'Field', name: { kind: 'Name', value: 'subscribersCount' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'meta' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'postsCount' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'changelogsCount' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'docsCount' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  DashboardCommunityOverviewQuery,
  DashboardCommunityOverviewQueryVariables
>
export const DashboardCommunityTagGroupsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'DashboardCommunityTagGroups' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'thread' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Thread' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'communityTagGroups' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'thread' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'thread' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                { kind: 'Field', name: { kind: 'Name', value: 'index' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'tags' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'DashboardTagFields' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardTagFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommunityTag' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'layout' } },
          { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
          { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
          { kind: 'Field', name: { kind: 'Name', value: 'color' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
          { kind: 'Field', name: { kind: 'Name', value: 'group' } },
          { kind: 'Field', name: { kind: 'Name', value: 'groupId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'slug' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  DashboardCommunityTagGroupsQuery,
  DashboardCommunityTagGroupsQueryVariables
>
export const DashboardUpdateCommunityTagDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'DashboardUpdateCommunityTag' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'color' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'RainbowColor' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'title' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'slug' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'extra' } },
          type: {
            kind: 'ListType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'marker' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'MarkerInput' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'groupId' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updateCommunityTag' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'color' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'color' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'title' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'title' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'slug' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'slug' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'extra' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'extra' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'marker' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'marker' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'groupId' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'groupId' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
                { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                { kind: 'Field', name: { kind: 'Name', value: 'groupId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'extra' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'marker' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  DashboardUpdateCommunityTagMutation,
  DashboardUpdateCommunityTagMutationVariables
>
export const DashboardCreateCommunityTagGroupDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'DashboardCreateCommunityTagGroup' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'thread' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Thread' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'title' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'createCommunityTagGroup' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'thread' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'thread' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'title' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'title' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                { kind: 'Field', name: { kind: 'Name', value: 'index' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'tags' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'DashboardTagFields' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardTagFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommunityTag' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'layout' } },
          { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
          { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
          { kind: 'Field', name: { kind: 'Name', value: 'color' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
          { kind: 'Field', name: { kind: 'Name', value: 'group' } },
          { kind: 'Field', name: { kind: 'Name', value: 'groupId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'slug' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  DashboardCreateCommunityTagGroupMutation,
  DashboardCreateCommunityTagGroupMutationVariables
>
export const DashboardUpdateCommunityTagGroupDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'DashboardUpdateCommunityTagGroup' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'title' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'thread' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Thread' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updateCommunityTagGroup' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'title' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'title' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'thread' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'thread' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                { kind: 'Field', name: { kind: 'Name', value: 'index' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'tags' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'DashboardTagFields' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DashboardTagFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'CommunityTag' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'layout' } },
          { kind: 'Field', name: { kind: 'Name', value: 'desc' } },
          { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
          { kind: 'Field', name: { kind: 'Name', value: 'color' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'src' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
          { kind: 'Field', name: { kind: 'Name', value: 'group' } },
          { kind: 'Field', name: { kind: 'Name', value: 'groupId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'community' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'slug' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  DashboardUpdateCommunityTagGroupMutation,
  DashboardUpdateCommunityTagGroupMutationVariables
>
export const DashboardCreateCommunityTagDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'DashboardCreateCommunityTag' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'thread' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Thread' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'title' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'slug' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'layout' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'color' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'RainbowColor' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'groupId' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'marker' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'MarkerInput' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'createCommunityTag' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'thread' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'thread' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'title' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'title' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'slug' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'slug' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'layout' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'layout' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'color' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'color' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'groupId' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'groupId' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'marker' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'marker' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'id' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  DashboardCreateCommunityTagMutation,
  DashboardCreateCommunityTagMutationVariables
>
export const DashboardReindexTagsInGroupDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'DashboardReindexTagsInGroup' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'thread' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Thread' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'groupId' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'tags' } },
          type: {
            kind: 'ListType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ReindexTagInput' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'reindexTagsInGroup' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'thread' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'thread' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'groupId' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'groupId' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'tags' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'tags' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'done' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  DashboardReindexTagsInGroupMutation,
  DashboardReindexTagsInGroupMutationVariables
>
export const DashboardReindexCommunityTagsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'DashboardReindexCommunityTags' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'thread' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Thread' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'tags' } },
          type: {
            kind: 'ListType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ReindexCommunityTagInput' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'reindexCommunityTags' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'thread' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'thread' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'tags' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'tags' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'done' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  DashboardReindexCommunityTagsMutation,
  DashboardReindexCommunityTagsMutationVariables
>
export const DashboardReindexCommunityTagGroupsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'DashboardReindexCommunityTagGroups' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'thread' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Thread' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'groups' } },
          type: {
            kind: 'ListType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'ReindexCommunityTagGroupInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'reindexCommunityTagGroups' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'thread' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'thread' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'groups' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'groups' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'done' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  DashboardReindexCommunityTagGroupsMutation,
  DashboardReindexCommunityTagGroupsMutationVariables
>
export const DocCoverDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'DocCover' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'view' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'DocCoverView' } },
          defaultValue: { kind: 'EnumValue', value: 'PUBLIC' },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'docCover' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'view' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'view' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'cards' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'groupNodeId' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'index' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'appearance' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'items' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'FragmentSpread',
                              name: { kind: 'Name', value: 'DocCoverItemFields' },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'pinnedDocs' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'nodeId' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'index' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'appearance' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'href' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'doc' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'author' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
                                  { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
                                ],
                              },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'document' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  { kind: 'Field', name: { kind: 'Name', value: 'thumbnail' } },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DocCoverMarkerFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Marker' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'type' } },
          { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
          { kind: 'Field', name: { kind: 'Name', value: 'src' } },
          { kind: 'Field', name: { kind: 'Name', value: 'unified' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'appearance' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'light' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'bg' } },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'dark' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'bg' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DocCoverItemFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'DocCoverCardItem' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nodeId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'docId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'index' } },
          { kind: 'Field', name: { kind: 'Name', value: 'type' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'href' } },
          { kind: 'Field', name: { kind: 'Name', value: 'badge' } },
          { kind: 'Field', name: { kind: 'Name', value: 'leafCount' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'marker' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'FragmentSpread', name: { kind: 'Name', value: 'DocCoverMarkerFields' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DocCoverQuery, DocCoverQueryVariables>
export const GroupedKanbanPostsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'GroupedKanbanPosts' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'groupedKanbanPosts' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'backlog' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'entries' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'cat' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'community' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
                                ],
                              },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'meta' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
                                ],
                              },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'author' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'FragmentSpread',
                                    name: { kind: 'Name', value: 'KanbanAuthorFields' },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                      { kind: 'FragmentSpread', name: { kind: 'Name', value: 'KanbanPageFields' } },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'todo' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'entries' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'cat' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'community' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
                                ],
                              },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'meta' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
                                ],
                              },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'author' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'FragmentSpread',
                                    name: { kind: 'Name', value: 'KanbanAuthorFields' },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                      { kind: 'FragmentSpread', name: { kind: 'Name', value: 'KanbanPageFields' } },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'wip' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'entries' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'cat' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'community' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
                                ],
                              },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'meta' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
                                ],
                              },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'author' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'FragmentSpread',
                                    name: { kind: 'Name', value: 'KanbanAuthorFields' },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                      { kind: 'FragmentSpread', name: { kind: 'Name', value: 'KanbanPageFields' } },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'done' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'entries' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'cat' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'community' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
                                ],
                              },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'meta' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
                                ],
                              },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'author' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'FragmentSpread',
                                    name: { kind: 'Name', value: 'KanbanAuthorFields' },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                      { kind: 'FragmentSpread', name: { kind: 'Name', value: 'KanbanPageFields' } },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'rejected' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'entries' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'cat' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'community' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
                                ],
                              },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'meta' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  { kind: 'Field', name: { kind: 'Name', value: 'thread' } },
                                ],
                              },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'author' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'FragmentSpread',
                                    name: { kind: 'Name', value: 'KanbanAuthorFields' },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                      { kind: 'FragmentSpread', name: { kind: 'Name', value: 'KanbanPageFields' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'KanbanAuthorFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'User' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'login' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
          { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
          { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shortbio' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'KanbanPageFields' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'PagedPosts' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'totalPages' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageSize' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pageNumber' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<GroupedKanbanPostsQuery, GroupedKanbanPostsQueryVariables>
export const UserPassportDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'UserPassport' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'login' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'user' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'login' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'login' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'passportString' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'social' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'github' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'twitter' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'zhihu' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<UserPassportQuery, UserPassportQueryVariables>
export const AllPassportRulesDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'AllPassportRules' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'allPassportRulesString' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'cms' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<AllPassportRulesQuery, AllPassportRulesQueryVariables>
export const UpdateModeratorPassportDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdateModeratorPassport' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'user' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'rules' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Json' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updateModeratorPassport' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'user' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'user' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'rules' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'rules' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'moderators' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'isRoot' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'passportItemCount' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'user' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'login' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  UpdateModeratorPassportMutation,
  UpdateModeratorPassportMutationVariables
>
export const RemoveModeratorDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'RemoveModerator' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'user' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'removeModerator' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'user' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'user' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'moderators' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'isRoot' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'passportItemCount' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'user' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'login' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'nickname' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<RemoveModeratorMutation, RemoveModeratorMutationVariables>
export const PostThreadFreshDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'PostThreadFresh' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ArticlePathInput' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'userHasLogin' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Boolean' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'post' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'article' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'innerId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'views' } },
                { kind: 'Field', name: { kind: 'Name', value: 'upvotesCount' } },
                { kind: 'Field', name: { kind: 'Name', value: 'commentsCount' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'viewerHasViewed' },
                  directives: [
                    {
                      kind: 'Directive',
                      name: { kind: 'Name', value: 'include' },
                      arguments: [
                        {
                          kind: 'Argument',
                          name: { kind: 'Name', value: 'if' },
                          value: {
                            kind: 'Variable',
                            name: { kind: 'Name', value: 'userHasLogin' },
                          },
                        },
                      ],
                    },
                  ],
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'viewerHasUpvoted' },
                  directives: [
                    {
                      kind: 'Directive',
                      name: { kind: 'Name', value: 'include' },
                      arguments: [
                        {
                          kind: 'Argument',
                          name: { kind: 'Name', value: 'if' },
                          value: {
                            kind: 'Variable',
                            name: { kind: 'Name', value: 'userHasLogin' },
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PostThreadFreshQuery, PostThreadFreshQueryVariables>
export const RichEditorSimpleQueryDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'RichEditorSimpleQuery' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ArticlePathInput' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'post' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'article' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'article' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'innerId' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<RichEditorSimpleQueryQuery, RichEditorSimpleQueryQueryVariables>
export const DeleteCommunityTagDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'DeleteCommunityTag' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'thread' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Thread' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'deleteCommunityTag' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'thread' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'thread' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'id' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DeleteCommunityTagMutation, DeleteCommunityTagMutationVariables>
export const CreateCommunityTagDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'CreateCommunityTag' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'thread' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Thread' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'title' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'slug' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'layout' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'color' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'RainbowColor' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'groupId' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'marker' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'MarkerInput' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'createCommunityTag' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'thread' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'thread' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'title' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'title' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'slug' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'slug' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'layout' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'layout' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'color' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'color' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'groupId' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'groupId' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'marker' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'marker' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'id' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CreateCommunityTagMutation, CreateCommunityTagMutationVariables>
export const UpdateCommunityTagDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdateCommunityTag' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'color' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'RainbowColor' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'title' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'layout' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'desc' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'slug' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'groupId' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'marker' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'MarkerInput' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updateCommunityTag' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'color' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'color' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'title' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'title' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'desc' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'desc' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'layout' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'layout' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'slug' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'slug' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'community' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'community' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'groupId' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'groupId' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'marker' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'marker' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'id' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<UpdateCommunityTagMutation, UpdateCommunityTagMutationVariables>
