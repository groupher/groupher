/**
 * Protects a confirmed Article upvote viewer state while read projections catch up.
 *
 *   successful upvote payload private state
 *     -> account/path-scoped session receipt
 *     -> viewer-state overlay when receipt revision is newer
 *     -> clear after public and private revisions catch up or TTL expires
 *
 * The receipt records the private InteractionState revision, not a separately read ArticleStats
 * revision. It is a cache-convergence aid and never represents the domain fact itself.
 */
import { CONFIRMED_WRITE_RECEIPT_TTL_MS } from '~/constant/cache'
import type { EmotionType } from '~/lib/graphql/generated/graphql'
import type { TArticleStats, TArticleViewerState } from '~/spec'

import {
  clearSessionReceipts,
  listSessionReceipts,
  readSessionReceipt,
  removeSessionReceipt,
  writeSessionReceipt,
} from '../sessionReceiptStorage'

const RECEIPT_VERSION = 5
const storagePrefix = 'groupher:article-upvote-receipt:'

type TArticleReceiptViewerState = {
  viewerHasUpvoted: boolean
  viewerHasCollected: boolean | null
  viewerEmotion: EmotionType | null
}

export type TArticleUpvoteReceipt = {
  schemaVersion: 5
  commandId: string
  accountScope: string
  entityKey: string
  interactionRevision?: number
  viewerState: TArticleReceiptViewerState
  confirmedAt: number
  expiresAt: number
}

type TArticleUpvoteConfirmation = {
  commandId: string
  accountScope: string
  entityKey: string
  viewerHasUpvoted: boolean
  interactionRevision?: number
  viewerHasCollected?: boolean | null
  viewerEmotion?: EmotionType | null
}

const storageKey = (accountScope: string, entityKey: string): string =>
  `${storagePrefix}${accountScope}:${entityKey}`

const validReceipt = (receipt: TArticleUpvoteReceipt): boolean =>
  Boolean(receipt.accountScope && receipt.entityKey && receipt.viewerState)

/** Reads one account/path-scoped confirmation and removes invalid or expired storage. */
export const readArticleUpvoteReceipt = (
  accountScope: string | null,
  entityKey: string,
): TArticleUpvoteReceipt | null => {
  if (!accountScope) return null
  return readSessionReceipt(
    storageKey(accountScope, entityKey),
    RECEIPT_VERSION,
    (receipt: TArticleUpvoteReceipt) =>
      validReceipt(receipt) &&
      receipt.accountScope === accountScope &&
      receipt.entityKey === entityKey,
  )
}

/** Writes the latest confirmed private state without replacing a newer receipt revision. */
export const writeArticleUpvoteReceipt = (confirmation: TArticleUpvoteConfirmation): void => {
  const { accountScope, entityKey, interactionRevision } = confirmation
  const existing = readArticleUpvoteReceipt(accountScope, entityKey)
  const existingRevision = existing?.interactionRevision
  if (
    existing &&
    typeof existingRevision === 'number' &&
    (typeof interactionRevision !== 'number' || existingRevision > interactionRevision)
  ) {
    return
  }

  const confirmedAt = Math.max(Date.now(), existing?.confirmedAt || 0)
  const receipt: TArticleUpvoteReceipt = {
    schemaVersion: RECEIPT_VERSION,
    commandId: confirmation.commandId,
    accountScope,
    entityKey,
    interactionRevision,
    viewerState: {
      viewerHasUpvoted: confirmation.viewerHasUpvoted,
      viewerHasCollected: confirmation.viewerHasCollected ?? null,
      viewerEmotion: confirmation.viewerEmotion ?? null,
    },
    confirmedAt,
    expiresAt: confirmedAt + CONFIRMED_WRITE_RECEIPT_TTL_MS,
  }

  listSessionReceipts(storagePrefix, RECEIPT_VERSION, validReceipt)
  writeSessionReceipt(storageKey(accountScope, entityKey), receipt)
}

/** Removes one confirmation after public and private projections have caught up. */
export const clearArticleUpvoteReceipt = (accountScope: string | null, entityKey: string): void => {
  if (accountScope) removeSessionReceipt(storageKey(accountScope, entityKey))
}

/** Clears every Article upvote confirmation at an account/session boundary. */
export const clearArticleUpvoteReceipts = (accountScope: string | null): void => {
  if (accountScope) clearSessionReceipts(`${storagePrefix}${accountScope}:`)
}

/** Returns whether a receipt is newer than the public Interaction owner snapshot. */
export const isArticleUpvoteReceiptNewer = (
  stats: TArticleStats | null | undefined,
  receipt: TArticleUpvoteReceipt | null,
): boolean => {
  if (!receipt) return false
  const revision = receipt.interactionRevision
  if (typeof revision !== 'number') return true
  const articleRevision = stats?.interactionRevision
  if (typeof articleRevision !== 'number') return true
  return revision > articleRevision
}

/** Overlays confirmed private relation fields only while the public revision is still older. */
export const overlayArticleUpvoteReceiptOnViewerState = (
  stats: TArticleStats | null | undefined,
  viewerState: TArticleViewerState,
  receipt: TArticleUpvoteReceipt | null,
): TArticleViewerState => {
  return isArticleUpvoteReceiptNewer(stats, receipt)
    ? {
        ...viewerState,
        ...receipt?.viewerState,
        viewerHasCollected:
          receipt?.viewerState.viewerHasCollected ?? viewerState.viewerHasCollected,
        interactionRevision: receipt?.interactionRevision,
      }
    : viewerState
}
