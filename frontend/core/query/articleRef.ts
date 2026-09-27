import type { TArticle, TArticleThread } from '~/spec'

import type { TViewerArticleRef } from './viewer'

export type TArticleRef = TViewerArticleRef & { thread: TArticleThread }

/** Returns the canonical identity used by Article stats and viewer-state queries. */
export const articleRefOf = (article: TArticle): TArticleRef => ({
  community: article.community?.slug || '',
  thread: article.meta?.thread as TArticleThread,
  innerId: String(article.innerId || ''),
})

/** Serializes one canonical Article identity for caches and session acknowledgements. */
export const articleRefKey = (
  article: Pick<TViewerArticleRef, 'community' | 'thread' | 'innerId'>,
): string => `${article.community}:${article.thread}:${String(article.innerId)}`
