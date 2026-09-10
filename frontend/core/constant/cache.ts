import type { TThread } from '~/spec'

const CACHE_TAG_PATTERN = /^community\[[A-Za-z0-9][A-Za-z0-9-]*\](?:-[A-Za-z0-9\x5b\x5d-]+)?$/

export const PUBLIC_CACHE_FRESH_SECONDS = 60
export const PUBLIC_CACHE_STALE_WHILE_REVALIDATE_SECONDS = 300
const RECEIPT_RECONCILE_MARGIN_SECONDS = 60
export const CONFIRMED_COMMENT_RECEIPT_MAX_REFS = 100

/** Keeps confirmed writes visible beyond the maximum public CDN stale window. */
export const CONFIRMED_WRITE_RECEIPT_TTL_MS =
  (PUBLIC_CACHE_FRESH_SECONDS +
    PUBLIC_CACHE_STALE_WHILE_REVALIDATE_SECONDS +
    RECEIPT_RECONCILE_MARGIN_SECONDS) *
  1_000

const communityCache = (community: string): string => {
  return `community[${community}]`
}

const tagsCache = (community: string, thread: TThread): string => {
  return `community[${community}]-thread[${thread}]-tags`
}

const articlesCache = (community: string, thread: TThread): string => {
  return `community[${community}]-thread[${thread}]-articles`
}

const articleCache = (community: string, thread: TThread, innerId: string | number): string => {
  return `community[${community}]-thread[${thread}]-article[${innerId}]`
}

const commentsCache = (community: string, thread: TThread, innerId: string | number): string => {
  return `community[${community}]-thread[${thread}]-article[${innerId}]-comments`
}

const docTreeCache = (community: string): string => `community[${community}]-doc-tree`

export const CACHE_TAG = {
  communityCache,
  tagsCache,
  articlesCache,
  articleCache,
  commentsCache,
  docTreeCache,
}

/** Validates the public cache-tag wire contract shared by Dash and Community. */
export const isCacheTag = (value: unknown): value is string =>
  typeof value === 'string' && CACHE_TAG_PATTERN.test(value)
