import type { TArticle, TComment } from '~/spec'

type TRevisioned = {
  articleInteractionRevision?: number | null
  commentInteractionRevision?: number | null
  commentsRevision?: number | null
  viewsRevision?: number | null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object'

const isArticle = (value: unknown): value is TArticle & TRevisioned => {
  if (!isRecord(value)) return false
  return 'innerId' in value && 'community' in value && 'meta' in value
}

const isComment = (value: unknown): value is TComment & TRevisioned => {
  if (!isRecord(value)) return false
  return 'innerId' in value && !('community' in value) && ('bodyHtml' in value || 'body' in value)
}

const sameArticle = (left: TArticle, right: TArticle): boolean =>
  String(left.innerId) === String(right.innerId) &&
  left.community?.slug === right.community?.slug &&
  left.meta?.thread === right.meta?.thread

const copyIfOlder = <T extends TRevisioned>(
  previous: T,
  next: T,
  revision: keyof TRevisioned,
  fields: readonly (keyof T)[],
): T => {
  const previousRevision = previous[revision]
  const nextRevision = next[revision]
  if (
    typeof previousRevision !== 'number' ||
    (typeof nextRevision === 'number' && nextRevision >= previousRevision)
  )
    return next

  const preserved = { ...next, [revision]: previousRevision } as T
  for (const field of fields) {
    if (field in previous) preserved[field] = previous[field]
  }
  return preserved
}

const mergeArticle = (previous: TArticle & TRevisioned, next: TArticle & TRevisioned) => {
  if (!sameArticle(previous, next)) return next

  let merged = next
  merged = copyIfOlder(previous, merged, 'articleInteractionRevision', [
    'upvotesCount',
    'collectsCount',
    'emotions',
  ])
  merged = copyIfOlder(previous, merged, 'commentsRevision', ['commentsCount'])
  merged = copyIfOlder(previous, merged, 'viewsRevision', ['views'])

  if (
    typeof previous.articleInteractionRevision === 'number' &&
    (typeof next.articleInteractionRevision !== 'number' ||
      next.articleInteractionRevision < previous.articleInteractionRevision) &&
    previous.meta
  ) {
    merged = {
      ...merged,
      meta: {
        ...merged.meta,
        ...(previous.meta.latestUpvotedUsers
          ? { latestUpvotedUsers: previous.meta.latestUpvotedUsers }
          : {}),
      },
    }
  }
  return merged
}

/** Applies an authoritative Comment aggregate without allowing its revision to move backwards. */
export const mergeArticleCommentsProjection = (
  current: TArticle,
  confirmed: { commentsCount: number; commentsRevision: number },
): TArticle => {
  if (
    typeof current.commentsRevision === 'number' &&
    current.commentsRevision > confirmed.commentsRevision
  ) {
    return current
  }
  return {
    ...current,
    commentsCount: confirmed.commentsCount,
    commentsRevision: confirmed.commentsRevision,
  }
}

const sameComment = (left: TComment, right: TComment): boolean =>
  String(left.innerId) === String(right.innerId)

const mergeComment = (previous: TComment & TRevisioned, next: TComment & TRevisioned) => {
  if (!sameComment(previous, next)) return next
  const merged = copyIfOlder(previous, next, 'commentInteractionRevision', [
    'upvotesCount',
    'emotions',
  ])
  return {
    ...merged,
    replies: mergeCommentEntries(previous.replies, merged.replies),
    replyToComment:
      previous.replyToComment && merged.replyToComment
        ? mergeComment(previous.replyToComment, merged.replyToComment)
        : merged.replyToComment,
  }
}

const mergeArticleEntries = (previous: unknown, next: unknown): unknown => {
  if (!Array.isArray(previous) || !Array.isArray(next)) return next
  const previousByKey = new Map(
    previous
      .filter(isArticle)
      .map((article) => [
        `${article.community?.slug}:${article.meta?.thread}:${String(article.innerId)}`,
        article,
      ]),
  )
  return next.map((article) => {
    if (!isArticle(article)) return article
    const previousArticle = previousByKey.get(
      `${article.community?.slug}:${article.meta?.thread}:${String(article.innerId)}`,
    )
    return previousArticle ? mergeArticle(previousArticle, article) : article
  })
}

const mergeCommentEntries = (previous: unknown, next: unknown): unknown => {
  if (!Array.isArray(previous) || !Array.isArray(next)) return next
  const previousByKey = new Map(
    previous.filter(isComment).map((comment) => [String(comment.innerId), comment]),
  )
  return next.map((comment) => {
    if (!isComment(comment)) return comment
    const previousComment = previousByKey.get(String(comment.innerId))
    return previousComment ? mergeComment(previousComment, comment) : comment
  })
}

/** Keeps a newer Article projection when a background response is stale. */
export const preserveArticleProjection = (previous: unknown, next: unknown): unknown => {
  if (isArticle(previous) && isArticle(next)) return mergeArticle(previous, next)
  if (isRecord(previous) && isRecord(next) && 'entries' in previous && 'entries' in next) {
    return { ...next, entries: mergeArticleEntries(previous.entries, next.entries) }
  }
  return next
}

/** Keeps newer Comment reaction projections when a background response is stale. */
export const preserveCommentProjection = (previous: unknown, next: unknown): unknown => {
  if (isComment(previous) && isComment(next)) return mergeComment(previous, next)
  if (isRecord(previous) && isRecord(next) && 'entries' in previous && 'entries' in next) {
    return { ...next, entries: mergeCommentEntries(previous.entries, next.entries) }
  }
  return next
}
