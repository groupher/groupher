import { CONFIRMED_WRITE_RECEIPT_TTL_MS } from '~/constant/cache'

import {
  clearSessionReceipts,
  listSessionReceipts,
  readSessionReceipt,
  removeSessionReceipt,
  writeSessionReceipt,
} from './sessionReceiptStorage'

const ACK_VERSION = 1
const storagePrefix = 'groupher:view-ack:'

export type TArticleViewAck = {
  schemaVersion: 1
  articleRef: string
  confirmedAt: number
  expiresAt: number
}

const storageKey = (articleRef: string): string => `${storagePrefix}${articleRef}`
const validAck = (ack: TArticleViewAck): boolean => Boolean(ack.articleRef)

/** Remembers that the server accepted one view until viewer state catches up. */
export const writeArticleViewAck = (articleRef: string): void => {
  const confirmedAt = Date.now()
  listSessionReceipts(storagePrefix, ACK_VERSION, validAck)
  writeSessionReceipt(storageKey(articleRef), {
    schemaVersion: ACK_VERSION,
    articleRef,
    confirmedAt,
    expiresAt: confirmedAt + CONFIRMED_WRITE_RECEIPT_TTL_MS,
  })
}

/** Reads a live same-session acknowledgement for one Article view. */
export const readArticleViewAck = (articleRef: string): TArticleViewAck | null =>
  readSessionReceipt(
    storageKey(articleRef),
    ACK_VERSION,
    (ack: TArticleViewAck) => validAck(ack) && ack.articleRef === articleRef,
  )

/** Removes one acknowledgement after authoritative viewer state confirms it. */
export const clearArticleViewAck = (articleRef: string): void => {
  removeSessionReceipt(storageKey(articleRef))
}

/** Clears all same-session view acknowledgements at an account boundary. */
export const clearArticleViewAcks = (): void => {
  clearSessionReceipts(storagePrefix)
}
