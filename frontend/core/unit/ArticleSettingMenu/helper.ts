import { GraphQLRequestError } from '~/lib/graphql/client'
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

/** Identifies the canonical stale WorkingCopy revision response. */
export const isWorkingCopyRevisionConflict = (error: unknown): boolean =>
  error instanceof GraphQLRequestError &&
  error.errors.some(({ extensions }) => {
    const code = extensions?.code
    const reason = extensions?.reason ?? extensions?.reasonCode
    return (
      String(code) === '4561' ||
      reason === 'revision_conflict' ||
      reason === 'article_working_copy_revision_conflict'
    )
  })
