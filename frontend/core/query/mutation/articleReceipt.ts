import { CONFIRMED_WRITE_RECEIPT_TTL_MS } from '~/constant/cache'
import type { TArticle, TEmotion, TUser } from '~/spec'

import {
  clearSessionReceipts,
  listSessionReceipts,
  readSessionReceipt,
  removeSessionReceipt,
  writeSessionReceipt,
} from '../sessionReceiptStorage'

const RECEIPT_VERSION = 3
const storagePrefix = 'groupher:article-upvote-receipt:'

type TArticleReactionProjection = {
  upvotesCount: number
  collectsCount: number
  emotions: Array<Pick<TEmotion, 'type' | 'count' | 'latestUsers'> | null>
  latestUpvotedUsers?: Array<Pick<TUser, 'login' | 'nickname' | 'avatar'>> | null
  articleInteractionRevision?: number
}

type TArticleViewerState = {
  viewerHasUpvoted: boolean
  viewerHasCollected: boolean | null
  viewerEmotion: string | null
}

export type TArticleUpvoteReceipt = {
  schemaVersion: 3
  commandId: string
  accountRef: string
  entityKey: string
  publicProjection: TArticleReactionProjection
  viewerState: TArticleViewerState
  confirmedAt: number
  expiresAt: number
}

type TArticleUpvoteConfirmation = {
  commandId: string
  accountRef: string
  entityKey: string
  upvotesCount: number
  viewerHasUpvoted: boolean
  collectsCount?: number
  articleInteractionRevision?: number
  emotions?: Array<Pick<TEmotion, 'type' | 'count' | 'latestUsers'> | null>
  latestUpvotedUsers?: Array<Pick<TUser, 'login' | 'nickname' | 'avatar'>> | null
  viewerHasCollected?: boolean | null
  viewerEmotion?: string | null
}

const storageKey = (accountRef: string, entityKey: string): string =>
  `${storagePrefix}${accountRef}:${entityKey}`

const validReceipt = (receipt: TArticleUpvoteReceipt): boolean =>
  Boolean(
    receipt.accountRef && receipt.entityKey && receipt.publicProjection && receipt.viewerState,
  )

/** Reads one valid account-scoped Article reaction confirmation. */
export const readArticleUpvoteReceipt = (
  accountRef: string | null,
  entityKey: string,
): TArticleUpvoteReceipt | null => {
  if (!accountRef) return null
  return readSessionReceipt(
    storageKey(accountRef, entityKey),
    RECEIPT_VERSION,
    (receipt: TArticleUpvoteReceipt) =>
      validReceipt(receipt) && receipt.accountRef === accountRef && receipt.entityKey === entityKey,
  )
}

/** Replaces an Article slot only when the confirmed reaction revision is not older. */
export const writeArticleUpvoteReceipt = (confirmation: TArticleUpvoteConfirmation): void => {
  const { accountRef, entityKey, articleInteractionRevision } = confirmation
  const existing = readArticleUpvoteReceipt(accountRef, entityKey)
  const existingRevision = existing?.publicProjection.articleInteractionRevision
  if (
    existing &&
    typeof existingRevision === 'number' &&
    (typeof articleInteractionRevision !== 'number' ||
      existingRevision > articleInteractionRevision)
  ) {
    return
  }

  const confirmedAt = Math.max(Date.now(), existing?.confirmedAt || 0)
  const receipt: TArticleUpvoteReceipt = {
    schemaVersion: RECEIPT_VERSION,
    commandId: confirmation.commandId,
    accountRef,
    entityKey,
    publicProjection: {
      upvotesCount: confirmation.upvotesCount,
      collectsCount: confirmation.collectsCount ?? 0,
      emotions: confirmation.emotions || [],
      latestUpvotedUsers: confirmation.latestUpvotedUsers,
      articleInteractionRevision,
    },
    viewerState: {
      viewerHasUpvoted: confirmation.viewerHasUpvoted,
      viewerHasCollected: confirmation.viewerHasCollected ?? null,
      viewerEmotion: confirmation.viewerEmotion ?? null,
    },
    confirmedAt,
    expiresAt: confirmedAt + CONFIRMED_WRITE_RECEIPT_TTL_MS,
  }

  listSessionReceipts(storagePrefix, RECEIPT_VERSION, validReceipt)
  writeSessionReceipt(storageKey(accountRef, entityKey), receipt)
}

/** Removes the Article slot after its public revision has caught up. */
export const clearArticleUpvoteReceipt = (accountRef: string | null, entityKey: string): void => {
  if (accountRef) removeSessionReceipt(storageKey(accountRef, entityKey))
}

/** Clears every Article reaction confirmation owned by one account. */
export const clearArticleUpvoteReceipts = (accountRef: string | null): void => {
  if (accountRef) clearSessionReceipts(`${storagePrefix}${accountRef}:`)
}

/** Compares the receipt's reaction revision with one public Article projection. */
export const isArticleUpvoteReceiptNewer = (
  article: Pick<TArticle, 'articleInteractionRevision'> | null | undefined,
  receipt: TArticleUpvoteReceipt | null,
): boolean => {
  if (!receipt) return false
  const revision = receipt.publicProjection.articleInteractionRevision
  if (typeof revision !== 'number') return true
  if (typeof article?.articleInteractionRevision !== 'number') return true
  return revision > article.articleInteractionRevision
}

/** Applies a complete confirmed public projection and viewer relation to an Article. */
export const overlayArticleUpvoteReceipt = (
  article: TArticle,
  receipt: TArticleUpvoteReceipt,
): TArticle => {
  const projection = receipt.publicProjection
  const viewer = receipt.viewerState
  return {
    ...article,
    upvotesCount: projection.upvotesCount,
    collectsCount: projection.collectsCount,
    emotions: projection.emotions,
    ...(Array.isArray(projection.latestUpvotedUsers)
      ? {
          meta: {
            ...(article.meta || {}),
            latestUpvotedUsers: projection.latestUpvotedUsers,
          },
        }
      : {}),
    viewerHasUpvoted: viewer.viewerHasUpvoted,
    viewerHasCollected: viewer.viewerHasCollected,
    viewerEmotion: viewer.viewerEmotion,
    ...(typeof projection.articleInteractionRevision === 'number'
      ? { articleInteractionRevision: projection.articleInteractionRevision }
      : {}),
  }
}

/** Overlays the account-scoped confirmation only while public data is behind it. */
export const overlayArticleUpvoteReceiptIfNewer = (
  accountRef: string | null,
  article: TArticle | null,
  entityKey: string,
): TArticle | null => {
  if (!article) return null
  const receipt = readArticleUpvoteReceipt(accountRef, entityKey)
  return isArticleUpvoteReceiptNewer(article, receipt)
    ? overlayArticleUpvoteReceipt(article, receipt as TArticleUpvoteReceipt)
    : article
}
