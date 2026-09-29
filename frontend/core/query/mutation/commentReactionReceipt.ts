import {
  CONFIRMED_COMMENT_RECEIPT_MAX_REFS,
  CONFIRMED_WRITE_RECEIPT_TTL_MS,
} from '~/constant/cache'
import type { TComment, TEmotion } from '~/spec'

import {
  clearSessionReceipts,
  listSessionReceipts,
  readSessionReceipt,
  removeSessionReceipt,
  writeSessionReceipt,
} from '../sessionReceiptStorage'

const RECEIPT_VERSION = 3
const storagePrefix = 'groupher:comment-reaction-receipt:'

type TCommentReactionProjection = {
  upvotesCount: number
  emotions: Array<Pick<TEmotion, 'type' | 'count' | 'latestUsers'>>
  commentInteractionRevision?: number
}

type TCommentViewerState = {
  viewerHasUpvoted: boolean
  viewerEmotion?: string | null
}

export type TCommentReactionReceipt = {
  schemaVersion: 3
  commandId: string
  accountRef: string
  articleKey: string
  commentRef: string
  publicProjection: TCommentReactionProjection
  viewerState: TCommentViewerState
  confirmedAt: number
  expiresAt: number
}

type TCommentReactionConfirmation = {
  commandId: string
  accountRef: string
  articleKey: string
  commentRef: string
  upvotesCount: number
  emotions: TCommentReactionProjection['emotions']
  viewerHasUpvoted: boolean
  viewerEmotion?: string | null
  commentInteractionRevision?: number
}

const storageKey = (accountRef: string, articleKey: string, commentRef: string): string =>
  `${storagePrefix}${accountRef}:${articleKey}:${commentRef}`

const validReceipt = (receipt: TCommentReactionReceipt): boolean =>
  Boolean(
    receipt.accountRef &&
    receipt.articleKey &&
    receipt.commentRef &&
    receipt.publicProjection &&
    receipt.viewerState,
  )

/** Stores the latest complete reaction projection for one account and Comment. */
export const writeCommentReactionReceipt = (confirmation: TCommentReactionConfirmation): void => {
  const { accountRef, articleKey, commentRef, commentInteractionRevision } = confirmation
  const existing = readCommentReactionReceipt(accountRef, articleKey, commentRef)
  const existingRevision = existing?.publicProjection.commentInteractionRevision
  if (
    existing &&
    typeof existingRevision === 'number' &&
    (typeof commentInteractionRevision !== 'number' ||
      existingRevision > commentInteractionRevision)
  ) {
    return
  }

  const confirmedAt = Math.max(Date.now(), existing?.confirmedAt || 0)
  const receipt: TCommentReactionReceipt = {
    schemaVersion: RECEIPT_VERSION,
    commandId: confirmation.commandId,
    accountRef,
    articleKey,
    commentRef,
    publicProjection: {
      upvotesCount: confirmation.upvotesCount,
      emotions: confirmation.emotions,
      commentInteractionRevision,
    },
    viewerState: {
      viewerHasUpvoted: confirmation.viewerHasUpvoted,
      viewerEmotion: confirmation.viewerEmotion,
    },
    confirmedAt,
    expiresAt: confirmedAt + CONFIRMED_WRITE_RECEIPT_TTL_MS,
  }

  const articlePrefix = `${storagePrefix}${accountRef}:${articleKey}:`
  const receipts = listSessionReceipts(
    articlePrefix,
    RECEIPT_VERSION,
    (item: TCommentReactionReceipt) =>
      validReceipt(item) && item.accountRef === accountRef && item.articleKey === articleKey,
  )
  writeSessionReceipt(storageKey(accountRef, articleKey, commentRef), receipt)
  const staleReceipts = receipts
    .filter((entry) => entry.key !== storageKey(accountRef, articleKey, commentRef))
    .sort((left, right) => right.receipt.confirmedAt - left.receipt.confirmedAt)
    .slice(CONFIRMED_COMMENT_RECEIPT_MAX_REFS - 1)
  for (const entry of staleReceipts) removeSessionReceipt(entry.key)
}

/** Reads one valid account-scoped Comment reaction confirmation. */
export const readCommentReactionReceipt = (
  accountRef: string | null,
  articleKey: string,
  commentRef: string,
): TCommentReactionReceipt | null => {
  if (!accountRef) return null
  return readSessionReceipt(
    storageKey(accountRef, articleKey, commentRef),
    RECEIPT_VERSION,
    (receipt: TCommentReactionReceipt) =>
      validReceipt(receipt) &&
      receipt.accountRef === accountRef &&
      receipt.articleKey === articleKey &&
      receipt.commentRef === commentRef,
  )
}

/** Lists bounded Comment reaction confirmations for one Article and account. */
export const readCommentReactionReceipts = (
  accountRef: string | null,
  articleKey: string,
): TCommentReactionReceipt[] => {
  if (!accountRef) return []
  return listSessionReceipts(
    `${storagePrefix}${accountRef}:${articleKey}:`,
    RECEIPT_VERSION,
    (receipt: TCommentReactionReceipt) =>
      validReceipt(receipt) &&
      receipt.accountRef === accountRef &&
      receipt.articleKey === articleKey,
  ).map(({ receipt }) => receipt)
}

/** Applies a confirmed public reaction projection and viewer relation to a Comment. */
export const overlayCommentReactionReceipt = (
  comment: TComment,
  receipt: TCommentReactionReceipt,
): TComment => {
  const projection = receipt.publicProjection
  const viewer = receipt.viewerState
  const emotions = projection.emotions.map((emotion) => ({
    ...emotion,
    viewerHasReacted:
      typeof viewer.viewerEmotion === 'string' && viewer.viewerEmotion === emotion.type,
  })) as TComment['emotions']
  return {
    ...comment,
    upvotesCount: projection.upvotesCount,
    emotions,
    viewerHasUpvoted: viewer.viewerHasUpvoted,
    ...(typeof projection.commentInteractionRevision === 'number'
      ? { commentInteractionRevision: projection.commentInteractionRevision }
      : {}),
  }
}

/** Clears every Comment reaction confirmation owned by one account. */
export const clearCommentReactionReceipts = (accountRef: string | null): void => {
  if (accountRef) clearSessionReceipts(`${storagePrefix}${accountRef}:`)
}

/** Removes one Comment reaction slot after its public revision catches up. */
export const clearCommentReactionReceipt = (
  accountRef: string | null,
  articleKey: string,
  commentRef: string,
): void => {
  if (accountRef) removeSessionReceipt(storageKey(accountRef, articleKey, commentRef))
}
