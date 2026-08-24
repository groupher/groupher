import { Kind, parse } from 'graphql'

import { CACHE_TAG } from '~/const/cache'
import { THREAD } from '~/const/thread'
import type { TThread } from '~/spec'

type TArticlePath = {
  community?: unknown
  thread?: unknown
  innerId?: unknown
}

const ARTICLE_MUTATION =
  /(?:Upvote|Update|Set|Pin|Collect|Emotion|View|Delete).*(?:Post|Changelog|Doc)/i
const ARTICLE_PUBLISH_MUTATION = /^Publish(?!DocChanges).*(?:Post|Changelog|Doc)$/i
const COMMENT_MUTATION = /Comment/i
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

const readCommunity = (variables: Record<string, unknown>): string | null =>
  typeof variables.community === 'string' && variables.community ? variables.community : null

const articleTags = (community: string, thread: TThread, innerId: string | number): string[] => [
  CACHE_TAG.articleCache(community, thread, innerId),
  CACHE_TAG.articlesCache(community, thread),
]

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

  if (DOC_TREE_MUTATIONS.has(operationName)) return [CACHE_TAG.docTreeCache(community)]

  return null
}

/** Resolves public Next cache tags affected by a typed GraphQL mutation. */
export const mutationCacheTags = (
  source: string,
  variables: Record<string, unknown> = {},
): string[] => {
  let operationName = ''
  try {
    const document = parse(source)
    const operation = document.definitions.find(
      (definition) =>
        definition.kind === Kind.OPERATION_DEFINITION && definition.operation === 'mutation',
    )
    if (!operation || operation.kind !== Kind.OPERATION_DEFINITION) return []
    operationName = operation.name?.value || ''
  } catch {
    return []
  }

  const communityTags = communityScopedMutationTags(operationName, variables)
  if (communityTags) return communityTags

  if (
    !ARTICLE_MUTATION.test(operationName) &&
    !ARTICLE_PUBLISH_MUTATION.test(operationName) &&
    !COMMENT_MUTATION.test(operationName)
  ) {
    return []
  }
  const path = readPath(variables)
  if (
    !path ||
    typeof path.community !== 'string' ||
    typeof path.thread !== 'string' ||
    (typeof path.innerId !== 'string' && typeof path.innerId !== 'number')
  ) {
    return []
  }

  const thread = path.thread as TThread
  const tags = articleTags(path.community, thread, path.innerId)
  if (COMMENT_MUTATION.test(operationName)) {
    tags.push(CACHE_TAG.commentsCache(path.community, thread, path.innerId))
  }
  return tags
}
