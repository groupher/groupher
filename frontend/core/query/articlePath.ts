/**
 * Defines the single frontend identity for public Article transport and cache coordination.
 *
 *   Article content / GraphQL locator
 *     -> TArticlePath
 *     -> articlePathKey
 *     -> query keys, mutations, receipts, and viewer batches
 *
 * A path is public routing identity, not a React ref or the canonical database identity.
 */
import { ARTICLE_THREAD } from '~/const/thread'
import type { ArticlePathInput } from '~/lib/graphql/generated/graphql'
import type { TArticle, TArticleThread } from '~/spec'

export type TArticlePath = ArticlePathInput & { thread: TArticleThread }

const articleThreads = new Set<string>(Object.values(ARTICLE_THREAD))

/** Narrows a general CMS thread to the four public Article thread values accepted by path APIs. */
export const isArticleThread = (thread: string): thread is TArticleThread =>
  articleThreads.has(thread)

/** Extracts stable public coordinates from content without carrying presentation fields. */
export const articlePathOf = (article: TArticle): TArticlePath => ({
  community: article.community?.slug || '',
  thread: article.meta?.thread as TArticleThread,
  innerId: String(article.innerId || ''),
})

/**
 * Serializes one Article path into the shared in-memory/session key.
 *
 * Callers must pass already-normalized community and thread values; the function only normalizes
 * `innerId` to a string and does not parse or authorize the locator.
 */
export const articlePathKey = (article: {
  community: string
  thread: string
  innerId: string | number
}): string => `${article.community}:${article.thread}:${String(article.innerId)}`
