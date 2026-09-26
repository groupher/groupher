import { CONFIRMED_WRITE_RECEIPT_TTL_MS } from '~/constant/cache'
import type { TArticleStats, TArticleViewerState } from '~/spec'

import {
  clearSessionReceipts,
  listSessionReceipts,
  readSessionReceipt,
  removeSessionReceipt,
  writeSessionReceipt,
} from '../sessionReceiptStorage'

const RECEIPT_VERSION = 4
const storagePrefix = 'groupher:article-upvote-receipt:'

type TArticleReceiptViewerState = {
  viewerHasUpvoted: boolean
  viewerHasCollected: boolean | null
  viewerEmotion: string | null
}

export type TArticleUpvoteReceipt = {
  schemaVersion: 4
  commandId: string
  accountRef: string
  entityKey: string
  interactionRevision?: number
  viewerState: TArticleReceiptViewerState
  confirmedAt: number
  expiresAt: number
}

type TArticleUpvoteConfirmation = {
  commandId: string
  accountRef: string
  entityKey: string
  viewerHasUpvoted: boolean
  interactionRevision?: number
  viewerHasCollected?: boolean | null
  viewerEmotion?: string | null
}

const storageKey = (accountRef: string, entityKey: string): string =>
  `${storagePrefix}${accountRef}:${entityKey}`

const validReceipt = (receipt: TArticleUpvoteReceipt): boolean =>
  Boolean(receipt.accountRef && receipt.entityKey && receipt.viewerState)

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
  const { accountRef, entityKey, interactionRevision } = confirmation
  const existing = readArticleUpvoteReceipt(accountRef, entityKey)
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
    accountRef,
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
  writeSessionReceipt(storageKey(accountRef, entityKey), receipt)
}

/** Removes the private viewer confirmation after ViewerState has caught up. */
export const clearArticleUpvoteReceipt = (accountRef: string | null, entityKey: string): void => {
  if (accountRef) removeSessionReceipt(storageKey(accountRef, entityKey))
}

/** Clears every Article reaction confirmation owned by one account. */
export const clearArticleUpvoteReceipts = (accountRef: string | null): void => {
  if (accountRef) clearSessionReceipts(`${storagePrefix}${accountRef}:`)
}

/** Decides whether the private viewer confirmation still needs a public refetch. */
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

/** Applies a confirmed reaction receipt to the separate private viewer owner. */
export const overlayArticleUpvoteReceiptOnViewerState = (
  accountRef: string | null,
  stats: TArticleStats | null | undefined,
  viewerState: TArticleViewerState,
  entityKey: string,
): TArticleViewerState => {
  const receipt = readArticleUpvoteReceipt(accountRef, entityKey)
  return isArticleUpvoteReceiptNewer(stats, receipt)
    ? {
        ...viewerState,
        ...receipt?.viewerState,
        interactionRevision: receipt?.interactionRevision,
      }
    : viewerState
}
