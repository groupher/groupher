import { useContext } from 'react'
import { findIndex, includes, values } from 'ramda'
import { ARTICLE_THREAD } from '~/const/thread'
import { EMPTY_PAGED_ARTICLES } from '~/const/utils'
import { plural } from '~/fmt'
import useViewingArticle from '~/hooks/useViewingArticle'
import useViewingThread from '~/hooks/useViewingThread'
import type { TArticle } from '~/spec'
import { StoreContext } from '~/stores/articleList/provider'

type TRes = {
  previous: TArticle | null
  next: TArticle | null
}

export default function useNaviArticle(): TRes {
  const articles = useContext(StoreContext)
  const curThread = useViewingThread()
  const { article: viewingArticle } = useViewingArticle()

  if (!articles || !includes(curThread, values(ARTICLE_THREAD)) || !viewingArticle?.id) {
    return {
      previous: null,
      next: null,
    }
  }

  const viewingArticleId = viewingArticle.id

  let pagedArticles = EMPTY_PAGED_ARTICLES

  switch (curThread) {
    default: {
      pagedArticles = articles[`paged${plural(curThread, 'titleCase')}`]
      break
    }
  }

  const curIndex = findIndex((a: TArticle) => a.id === viewingArticleId, pagedArticles.entries)

  return {
    previous: pagedArticles.entries[curIndex - 1] || null,
    next: pagedArticles.entries[curIndex + 1] || null,
  }
}
