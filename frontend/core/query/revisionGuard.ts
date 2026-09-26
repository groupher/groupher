import type { TComment } from '~/spec'

type TRevisioned = {
  commentInteractionRevision?: number | null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object'

const isComment = (value: unknown): value is TComment & TRevisioned => {
  if (!isRecord(value)) return false
  return 'innerId' in value && !('community' in value) && ('bodyHtml' in value || 'body' in value)
}

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

/** Keeps newer Comment reaction projections when a background response is stale. */
export const preserveCommentProjection = (previous: unknown, next: unknown): unknown => {
  if (isComment(previous) && isComment(next)) return mergeComment(previous, next)
  if (isRecord(previous) && isRecord(next) && 'entries' in previous && 'entries' in next) {
    return { ...next, entries: mergeCommentEntries(previous.entries, next.entries) }
  }
  return next
}
