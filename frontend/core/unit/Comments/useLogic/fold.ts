import type { TComment, TID } from '~/spec'

/** True when every currently loaded root comment is folded. */
export const areAllCommentsFolded = (
  entries: readonly TComment[],
  foldedCommentIds: readonly TID[],
): boolean =>
  entries.length > 0 && entries.every((comment) => foldedCommentIds.includes(comment.innerId))
