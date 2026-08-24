import { Kind, parse } from 'graphql'

import { CACHE_TAG } from '~/const/cache'
import type { TThread } from '~/spec'

type TArticlePath = {
  community?: unknown
  thread?: unknown
  innerId?: unknown
}

const ARTICLE_MUTATION =
  /(?:Upvote|Update|Set|Pin|Collect|Emotion|View|Delete|Publish).*(?:Post|Changelog|Doc)/i
const COMMENT_MUTATION = /Comment/i

const readPath = (variables: Record<string, unknown>): TArticlePath | null => {
  const article = variables.article
  if (article && typeof article === 'object') return article as TArticlePath

  const comment = variables.comment
  if (!comment || typeof comment !== 'object') return null
  const nestedArticle = (comment as { article?: unknown }).article
  return nestedArticle && typeof nestedArticle === 'object' ? (nestedArticle as TArticlePath) : null
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

  if (!ARTICLE_MUTATION.test(operationName) && !COMMENT_MUTATION.test(operationName)) return []
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
  const tags = [
    CACHE_TAG.articleCache(path.community, thread, path.innerId),
    CACHE_TAG.articlesCache(path.community, thread),
  ]
  if (COMMENT_MUTATION.test(operationName)) {
    tags.push(CACHE_TAG.commentsCache(path.community, thread, path.innerId))
  }
  return tags
}
