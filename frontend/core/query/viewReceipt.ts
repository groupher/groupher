import { CONFIRMED_WRITE_RECEIPT_TTL_MS } from '~/constant/cache'

import {
  clearSessionReceipts,
  listSessionReceipts,
  readSessionReceipt,
  removeSessionReceipt,
  writeSessionReceipt,
} from './sessionReceiptStorage'

const RECEIPT_VERSION = 2
const storagePrefix = 'groupher:view-receipt:'

export type TArticleViewReceipt = {
  schemaVersion: 2
  articleRef: string
  viewEventId: string
  accepted: true
  confirmedAt: number
  expiresAt: number
}

const storageKey = (articleRef: string): string => `${storagePrefix}${articleRef}`

const validReceipt = (receipt: TArticleViewReceipt): boolean =>
  Boolean(receipt.articleRef && receipt.viewEventId && receipt.accepted === true)

/** Persists acceptance of one stable Article view event across a same-tab refresh. */
export const writeArticleViewReceipt = (articleRef: string, viewEventId: string): void => {
  const confirmedAt = Date.now()
  listSessionReceipts(storagePrefix, RECEIPT_VERSION, validReceipt)
  writeSessionReceipt(storageKey(articleRef), {
    schemaVersion: RECEIPT_VERSION,
    articleRef,
    viewEventId,
    accepted: true,
    confirmedAt,
    expiresAt: confirmedAt + CONFIRMED_WRITE_RECEIPT_TTL_MS,
  })
}

/** Reads a live acceptance receipt for one Article view event. */
export const readArticleViewReceipt = (articleRef: string): TArticleViewReceipt | null =>
  readSessionReceipt(
    storageKey(articleRef),
    RECEIPT_VERSION,
    (receipt: TArticleViewReceipt) => validReceipt(receipt) && receipt.articleRef === articleRef,
  )

/** Removes one accepted view receipt after viewer authority confirms it. */
export const clearArticleViewReceipt = (articleRef: string): void => {
  removeSessionReceipt(storageKey(articleRef))
}

/** Clears all same-session view receipts during account boundary cleanup. */
export const clearArticleViewReceipts = (): void => {
  clearSessionReceipts(storagePrefix)
}
