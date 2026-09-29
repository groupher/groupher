import {
  CONFIRMED_COMMENT_RECEIPT_MAX_REFS,
  CONFIRMED_WRITE_RECEIPT_TTL_MS,
} from '~/constant/cache'
import type { TComment } from '~/spec'

import {
  clearSessionReceipts,
  listSessionReceipts,
  readSessionReceipt,
  removeSessionReceipt,
  writeSessionReceipt,
} from '../sessionReceiptStorage'

const RECEIPT_VERSION = 3
const storagePrefix = 'groupher:comment-feed-receipt:'

type TCommentFeedProjection = {
  commentsRevision?: number
}

export type TCommentFeedEffect = {
  commandId: string
  type: 'create' | 'update' | 'delete'
  commentRef: string
  comment?: TComment
  tombstone?: true
  parentId?: string
  publicProjection: TCommentFeedProjection
  confirmedAt: number
  expiresAt: number
}

type TCommentFeedSlot = {
  schemaVersion: 3
  accountRef: string
  articleKey: string
  effects: Record<string, TCommentFeedEffect>
  expiresAt: number
}

type TCommentFeedConfirmation = Omit<
  TCommentFeedEffect,
  'confirmedAt' | 'expiresAt' | 'tombstone'
> & {
  accountRef: string
  articleKey: string
}

const storageKey = (accountRef: string, articleKey: string): string =>
  `${storagePrefix}${accountRef}:${articleKey}`

const validSlot = (slot: TCommentFeedSlot): boolean =>
  Boolean(slot.accountRef && slot.articleKey && slot.effects)

const readSlot = (accountRef: string, articleKey: string): TCommentFeedSlot | null =>
  readSessionReceipt(
    storageKey(accountRef, articleKey),
    RECEIPT_VERSION,
    (slot: TCommentFeedSlot) =>
      validSlot(slot) && slot.accountRef === accountRef && slot.articleKey === articleKey,
  )

/** Merges one confirmed create, update, or delete effect into the bounded Article slot. */
export const writeCommentFeedReceipt = (confirmation: TCommentFeedConfirmation): void => {
  const { accountRef, articleKey, commentRef } = confirmation
  listSessionReceipts(storagePrefix, RECEIPT_VERSION, validSlot)
  const current = readSlot(accountRef, articleKey)
  const existing = current?.effects[commentRef]
  const existingRevision = existing?.publicProjection.commentsRevision
  const confirmedRevision = confirmation.publicProjection.commentsRevision
  if (
    existing &&
    typeof existingRevision === 'number' &&
    (typeof confirmedRevision !== 'number' || existingRevision > confirmedRevision)
  ) {
    return
  }

  const confirmedAt = Math.max(Date.now(), existing?.confirmedAt || 0)
  const effect: TCommentFeedEffect = {
    commandId: confirmation.commandId,
    type: confirmation.type,
    commentRef,
    ...(confirmation.type === 'delete'
      ? { tombstone: true as const }
      : confirmation.comment
        ? { comment: confirmation.comment }
        : {}),
    ...(confirmation.parentId ? { parentId: confirmation.parentId } : {}),
    publicProjection: confirmation.publicProjection,
    confirmedAt,
    expiresAt: confirmedAt + CONFIRMED_WRITE_RECEIPT_TTL_MS,
  }
  const effects = Object.fromEntries(
    Object.entries({ ...(current?.effects || {}), [commentRef]: effect })
      .sort(([, left], [, right]) => right.confirmedAt - left.confirmedAt)
      .slice(0, CONFIRMED_COMMENT_RECEIPT_MAX_REFS),
  )
  writeSessionReceipt(storageKey(accountRef, articleKey), {
    schemaVersion: RECEIPT_VERSION,
    accountRef,
    articleKey,
    effects,
    expiresAt: Math.max(...Object.values(effects).map((item) => item.expiresAt)),
  })
}

/** Reads live Comment feed effects while pruning expired entries from their slot. */
export const readCommentFeedReceipts = (
  accountRef: string | null,
  articleKey: string,
): TCommentFeedEffect[] => {
  if (!accountRef) return []
  const slot = readSlot(accountRef, articleKey)
  if (!slot) return []
  const now = Date.now()
  const effects = Object.fromEntries(
    Object.entries(slot.effects).filter(([, effect]) => effect.expiresAt > now),
  )
  if (Object.keys(effects).length !== Object.keys(slot.effects).length) {
    if (Object.keys(effects).length === 0) removeSessionReceipt(storageKey(accountRef, articleKey))
    else
      writeSessionReceipt(storageKey(accountRef, articleKey), {
        ...slot,
        effects,
        expiresAt: Math.max(...Object.values(effects).map((effect) => effect.expiresAt)),
      })
  }
  return Object.values(effects).sort((left, right) => left.confirmedAt - right.confirmedAt)
}

/** Clears every Comment feed confirmation owned by one account. */
export const clearCommentFeedReceipts = (accountRef: string | null): void => {
  if (accountRef) clearSessionReceipts(`${storagePrefix}${accountRef}:`)
}

/** Removes one entity effect without discarding other unconsumed Comment confirmations. */
export const clearCommentFeedReceipt = (
  accountRef: string | null,
  articleKey: string,
  commentRef: string,
): void => {
  if (!accountRef) return
  const slot = readSlot(accountRef, articleKey)
  if (!slot?.effects[commentRef]) return
  const effects = { ...slot.effects }
  delete effects[commentRef]
  const key = storageKey(accountRef, articleKey)
  if (Object.keys(effects).length === 0) {
    removeSessionReceipt(key)
    return
  }
  writeSessionReceipt(key, {
    ...slot,
    effects,
    expiresAt: Math.max(...Object.values(effects).map((effect) => effect.expiresAt)),
  })
}
