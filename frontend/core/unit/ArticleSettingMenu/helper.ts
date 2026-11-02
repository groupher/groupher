import type { ArticlePathInput } from '~/lib/graphql/generated/graphql'
import type { TArticle } from '~/spec'

/** Builds the mutation identity only after the detail route has supplied every path segment. */
export const getArticlePath = (article: TArticle): ArticlePathInput | null => {
  if (!article.innerId || !article.community?.slug || !article.meta?.thread) return null

  return {
    innerId: String(article.innerId),
    community: article.community.slug,
    thread: article.meta.thread,
  }
}
