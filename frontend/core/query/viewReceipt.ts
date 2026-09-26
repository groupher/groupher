import { CONFIRMED_WRITE_RECEIPT_TTL_MS } from '~/constant/cache'

import {
  clearSessionReceipts,
  listSessionReceipts,
  readSessionReceipt,
  removeSessionReceipt,
  writeSessionReceipt,
} from './sessionReceiptStorage'

const RECEIPT_VERSION = 3
const storagePrefix = 'groupher:view-receipt:'

export type TArticleViewReceipt = {
  schemaVersion: 3
  articleRef: string
  eventId: string
  confirmedAt: number
  expiresAt: number
}

const storageKey = (articleRef: string): string => `${storagePrefix}${articleRef}`

const validReceipt = (receipt: TArticleViewReceipt): boolean =>
  Boolean(receipt.articleRef && receipt.eventId)

/** Persists a committed anonymous view decision across a same-tab refresh. */
export const writeArticleViewReceipt = (articleRef: string, eventId: string): void => {
  const confirmedAt = Date.now()
  listSessionReceipts(storagePrefix, RECEIPT_VERSION, validReceipt)
  writeSessionReceipt(storageKey(articleRef), {
    schemaVersion: RECEIPT_VERSION,
    articleRef,
    eventId,
    confirmedAt,
    expiresAt: confirmedAt + CONFIRMED_WRITE_RECEIPT_TTL_MS,
  })
}

/** Reads a live committed receipt for one anonymous Article view. */
export const readArticleViewReceipt = (articleRef: string): TArticleViewReceipt | null =>
  readSessionReceipt(
    storageKey(articleRef),
    RECEIPT_VERSION,
    (receipt: TArticleViewReceipt) => validReceipt(receipt) && receipt.articleRef === articleRef,
  )

/** Removes one view receipt after viewer authority confirms it. */
export const clearArticleViewReceipt = (articleRef: string): void => {
  removeSessionReceipt(storageKey(articleRef))
}

/** Clears all same-session view receipts during account boundary cleanup. */
export const clearArticleViewReceipts = (): void => {
  clearSessionReceipts(storagePrefix)
}
