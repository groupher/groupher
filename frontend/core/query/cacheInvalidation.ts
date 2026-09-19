/**
 * Maps successful typed GraphQL mutations to public-CDN cache effects.
 *
 * This is the current transport bridge shared by Community and Dash. Callers
 * parse the GraphQL response first and execute only an `immediate` effect after
 * a successful mutation. The browser never supplies raw purge tags; tags are
 * derived from known operation names and validated locator variables.
 *
 * Examples:
 *
 *   CreatePost({ community: "home" })
 *     -> immediate: community[home]-thread[POST]-articles
 *
 *   UpdatePostFromEditor({ article: { community: "home", thread: "POST", innerId: 42 } })
 *     -> immediate: article[42] detail + POST article list
 *
 *   QueryUpvotePost({ article: ... })
 *     -> none: the current browser invalidates ArticleStats; public HTML waits
 *        for its normal TTL instead of being purged for every count change
 *
 * Unknown or malformed operations return `null`; they never broaden to a
 * community-wide purge. The target architecture moves this ownership into a
 * typed transactional outbox and deletes this operation-name bridge rather
 * than keeping it as a compatibility fallback. See
 * `docs/architecture/public-cache-invalidation.md`.
 */
import { Kind, parse } from 'graphql'

import { CACHE_TAG } from '~/const/cache'
import { THREAD } from '~/const/thread'
import type { TThread } from '~/spec'

export type TCacheEffectMode = 'none' | 'immediate' | 'coalesced'

export type TCacheEffect = {
  mode: TCacheEffectMode
  tags: string[]
  operationName: string
}

type TArticlePath = {
  community?: unknown
  thread?: unknown
  innerId?: unknown
}

const ARTICLE_INTERACTIONS = new Set([
  'QueryUpvotePost',
  'QueryUndoUpvotePost',
  'QueryUpvoteChangelog',
  'QueryUndoUpvoteChangelog',
  'QueryUpvoteDoc',
  'QueryUndoUpvoteDoc',
])

const ARTICLE_CONTENT_MUTATIONS = new Set([
  'PinPost',
  'UndoPinPost',
  'SetPostCat',
  'SetPostStatus',
  'UpdatePostFromEditor',
  'UpdatePostFromMenu',
])

const COMMENT_INTERACTIONS = new Set([
  'UpvoteComment',
  'UndoUpvoteComment',
  'ReportComment',
  'UndoReportComment',
  'EmotionToComment',
  'UndoEmotionToComment',
])

const COMMENT_CONTENT_MUTATIONS = new Set([
  'CreateComment',
  'UpdateComment',
  'ReplyComment',
  'DeleteComment',
])

const DASHBOARD_CONFIG_MUTATIONS = new Set([
  'UpdateDashboardBaseInfo',
  'UpdateDashboardMediaReports',
  'UpdateDashboardThirdPartyAnalytics',
  'UpdateDashboardSeo',
  'UpdateDashboardEnable',
  'UpdateDashboardSocialLinks',
  'UpdateDashboardNameAlias',
  'UpdateDashboardDocFaq',
  'UpdateDashboardHeaderLinks',
  'UpdateDashboardFooterLinks',
  'UpdateDashboardFooterOnelineLinks',
  'UpdateDashboardLayout',
  'UpdateDashboardContentShadow',
  'PublishWallpaper',
  'RestoreWallpaperSnapshot',
  'UpdateDashboardPressConfig',
  'SaveCustomThemePreset',
  'SelectThemePreset',
  'DashboardAddModerator',
  'DashboardAddModerators',
  'UpdateModeratorPassport',
  'RemoveModerator',
])

const TAG_MUTATIONS = new Set([
  'DashboardUpdateCommunityTag',
  'DashboardCreateCommunityTagGroup',
  'DashboardUpdateCommunityTagGroup',
  'DashboardCreateCommunityTag',
  'DashboardReindexTagsInGroup',
  'DashboardReindexCommunityTags',
  'DashboardReindexCommunityTagGroups',
])

const DOC_TREE_MUTATIONS = new Set([
  'CreateDocTreeNode',
  'UpdateDocTreeNode',
  'DeleteDocTreeNode',
  'RestoreDocTreeTrashItem',
  'DuplicateDocTreeNode',
  'MoveDocTreeSubtreeToDraft',
  'AddDocCoverCard',
  'RemoveDocCoverCard',
  'ReorderDocCoverCards',
  'PinDocToCover',
  'UnpinDocFromCover',
  'ReorderDocCoverPinnedDocs',
  'UpdateDocCoverCardAppearance',
  'UpdatePinnedDocAppearance',
])

const readPath = (variables: Record<string, unknown>): TArticlePath | null => {
  const article = variables.article
  if (article && typeof article === 'object') return article as TArticlePath

  const comment = variables.comment
  if (!comment || typeof comment !== 'object') return null
  const nestedArticle = (comment as { article?: unknown }).article
  return nestedArticle && typeof nestedArticle === 'object' ? (nestedArticle as TArticlePath) : null
}

const readCommunity = (variables: Record<string, unknown>): string | null => {
  if (typeof variables.community === 'string' && variables.community) return variables.community

  const input = variables.input
  if (!input || typeof input !== 'object') return null
  const community = (input as { community?: unknown }).community
  return typeof community === 'string' && community ? community : null
}

const readThread = (variables: Record<string, unknown>): TThread | null =>
  typeof variables.thread === 'string' ? (variables.thread as TThread) : null

const articleTags = (community: string, thread: TThread, innerId: string | number): string[] => [
  CACHE_TAG.articleCache(community, thread, innerId),
  CACHE_TAG.articlesCache(community, thread),
]

const articlePathTags = (
  variables: Record<string, unknown>,
  includeComments: boolean,
): string[] => {
  const path = readPath(variables)
  if (
    !path ||
    typeof path.community !== 'string' ||
    typeof path.thread !== 'string' ||
    (typeof path.innerId !== 'string' && typeof path.innerId !== 'number')
  ) {
    return []
  }

  const tags = articleTags(path.community, path.thread as TThread, path.innerId)
  if (includeComments) {
    tags.push(CACHE_TAG.commentsCache(path.community, path.thread as TThread, path.innerId))
  }
  return tags
}

const communityScopedMutationTags = (
  operationName: string,
  variables: Record<string, unknown>,
): string[] | null => {
  const community = readCommunity(variables)
  if (!community) return null

  if (operationName === 'restoreTrashedPost') {
    const id = variables.id
    return typeof id === 'string' || typeof id === 'number'
      ? articleTags(community, THREAD.POST, id)
      : []
  }

  if (operationName === 'publishDocChanges') {
    return [CACHE_TAG.articlesCache(community, THREAD.DOC), CACHE_TAG.docTreeCache(community)]
  }

  if (operationName === 'CreatePost') {
    return [CACHE_TAG.articlesCache(community, THREAD.POST)]
  }

  if (DOC_TREE_MUTATIONS.has(operationName)) return [CACHE_TAG.docTreeCache(community)]

  if (DASHBOARD_CONFIG_MUTATIONS.has(operationName)) return [CACHE_TAG.communityCache(community)]

  if (TAG_MUTATIONS.has(operationName)) {
    const thread = readThread(variables)
    return thread
      ? [CACHE_TAG.tagsCache(community, thread), CACHE_TAG.articlesCache(community, thread)]
      : [CACHE_TAG.communityCache(community)]
  }

  return null
}

const readMutationName = (source: string): string => {
  try {
    const document = parse(source)
    const operation = document.definitions.find(
      (definition) =>
        definition.kind === Kind.OPERATION_DEFINITION && definition.operation === 'mutation',
    )
    return operation?.kind === Kind.OPERATION_DEFINITION ? operation.name?.value || '' : ''
  } catch {
    return ''
  }
}

/**
 * Resolves the current server-owned public-cache effect for one GraphQL mutation.
 *
 * `immediate` means the host schedules tag purge after a successful response;
 * `none` records that the operation was intentionally classified as a
 * high-frequency/private effect; `null` means no mapping exists and fails
 * closed without purging.
 */
export const mutationCacheEffect = (
  source: string,
  variables: Record<string, unknown> = {},
): TCacheEffect | null => {
  const operationName = readMutationName(source)
  if (!operationName) return null

  const communityTags = communityScopedMutationTags(operationName, variables)
  if (communityTags) return { mode: 'immediate', tags: communityTags, operationName }

  if (ARTICLE_INTERACTIONS.has(operationName)) {
    return { mode: 'none', tags: articlePathTags(variables, false), operationName }
  }
  if (COMMENT_INTERACTIONS.has(operationName)) {
    return { mode: 'none', tags: articlePathTags(variables, true), operationName }
  }
  if (ARTICLE_CONTENT_MUTATIONS.has(operationName)) {
    return { mode: 'immediate', tags: articlePathTags(variables, false), operationName }
  }
  if (COMMENT_CONTENT_MUTATIONS.has(operationName)) {
    return { mode: 'immediate', tags: articlePathTags(variables, true), operationName }
  }

  return null
}
