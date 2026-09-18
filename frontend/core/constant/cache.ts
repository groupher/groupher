import {
  ARTICLE_STATS_CACHE_POLICY,
  CONFIRMED_WRITE_RECEIPT_TTL_MS,
} from '@groupher/contracts/article-stats'

import type { TThread } from '~/spec'

const CACHE_TAG_PATTERN = /^community\[[A-Za-z0-9][A-Za-z0-9-]*\](?:-[A-Za-z0-9\x5b\x5d-]+)?$/

export const PUBLIC_CACHE_FRESH_SECONDS = ARTICLE_STATS_CACHE_POLICY.publicHtmlSMaxageSeconds
export const PUBLIC_CACHE_STALE_WHILE_REVALIDATE_SECONDS =
  ARTICLE_STATS_CACHE_POLICY.publicHtmlSwrSeconds
export const CONFIRMED_COMMENT_RECEIPT_MAX_REFS = 100

/** Keeps confirmed writes visible beyond the maximum public CDN stale window. */
export { CONFIRMED_WRITE_RECEIPT_TTL_MS }

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
