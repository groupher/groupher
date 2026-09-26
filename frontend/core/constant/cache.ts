import {
  ARTICLE_STATS_CACHE_POLICY,
  CONFIRMED_WRITE_RECEIPT_TTL_MS,
} from '@groupher/contracts/article-stats'
import { isPublicCacheTag, publicCacheTags } from '@groupher/contracts/public-cache'

import type { TThread } from '~/spec'

export const PUBLIC_CACHE_FRESH_SECONDS = ARTICLE_STATS_CACHE_POLICY.publicHtmlSMaxageSeconds
export const PUBLIC_CACHE_STALE_WHILE_REVALIDATE_SECONDS =
  ARTICLE_STATS_CACHE_POLICY.publicHtmlSwrSeconds
export const CONFIRMED_COMMENT_RECEIPT_MAX_REFS = 100

/** Keeps confirmed writes visible beyond the maximum public CDN stale window. */
export { CONFIRMED_WRITE_RECEIPT_TTL_MS }

export const CACHE_TAG = {
  communityCache: publicCacheTags.community,
  tagsCache: (community: string, thread: TThread) => publicCacheTags.tags(community, thread),
  articlesCache: (community: string, thread: TThread) =>
    publicCacheTags.articleList(community, thread),
  articleCache: publicCacheTags.articleDetail,
  commentsCache: publicCacheTags.comments,
  docTreeCache: publicCacheTags.docTree,
}

/** Validates the public cache-tag wire contract shared by Dash and Community. */
export const isCacheTag = (value: unknown): value is string => isPublicCacheTag(value)
