import { useInfiniteQuery } from '@tanstack/react-query'

import useViewingArticle from '~/hooks/useViewingArticle'
import { articleActivityQueries } from '~/query/articleActivity'
import useAccount from '~/stores/account/hooks'

/** Loads the selected Article Activity tab through its paged public ArticleLog query. */
export default function useArticleActivity() {
  const { articlePath } = useViewingArticle()
  const { accountScope } = useAccount()
  return useInfiniteQuery(articleActivityQueries.pages(articlePath, accountScope))
}
