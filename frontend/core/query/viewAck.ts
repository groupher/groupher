/**
 * Persists short-lived same-session confirmation for an accepted anonymous or signed-in view.
 *
 *   trackArticleView tracked=true
 *     -> ViewAck in sessionStorage
 *     -> Article state overlay
 *     -> clear after viewerHasViewed catches up or TTL expires
 *
 * An Ack is not an event log or idempotency receipt; server dedupe remains the counting authority.
 */
import { CONFIRMED_WRITE_RECEIPT_TTL_MS } from '~/constant/cache'

import {
  clearSessionReceipts,
  listSessionReceipts,
  readSessionReceipt,
  removeSessionReceipt,
  writeSessionReceipt,
} from './sessionReceiptStorage'

const ACK_VERSION = 2
const storagePrefix = 'groupher:view-ack:'

export type TArticleViewAck = {
  schemaVersion: 2
  articleKey: string
  confirmedAt: number
  expiresAt: number
}

const storageKey = (articleKey: string): string => `${storagePrefix}${articleKey}`
const validAck = (ack: TArticleViewAck): boolean => Boolean(ack.articleKey)

/** Stores a bounded confirmation that the server accepted this path as viewed. */
export const writeArticleViewAck = (articleKey: string): void => {
  const confirmedAt = Date.now()
  listSessionReceipts(storagePrefix, ACK_VERSION, validAck)
  writeSessionReceipt(storageKey(articleKey), {
    schemaVersion: ACK_VERSION,
    articleKey,
    confirmedAt,
    expiresAt: confirmedAt + CONFIRMED_WRITE_RECEIPT_TTL_MS,
  })
}

/** Reads and validates one live Ack, pruning malformed or expired storage eagerly. */
export const readArticleViewAck = (articleKey: string): TArticleViewAck | null =>
  readSessionReceipt(
    storageKey(articleKey),
    ACK_VERSION,
    (ack: TArticleViewAck) => validAck(ack) && ack.articleKey === articleKey,
  )

/** Removes one Ack after authoritative viewer state confirms the read. */
export const clearArticleViewAck = (articleKey: string): void => {
  removeSessionReceipt(storageKey(articleKey))
}

/** Clears all Article ViewAcks when the active account/session boundary changes. */
export const clearArticleViewAcks = (): void => {
  clearSessionReceipts(storagePrefix)
}
