import { includes, values, findIndex } from 'ramda'

import type { TArticle } from '~/spec'
import { plural } from '~/fmt'
import { ARTICLE_THREAD } from '~/const/thread'
import { EMPTY_PAGED_ARTICLES } from '~/const/utils'

import useViewingThread from '~/hooks/useViewingThread'
import useViewingArticle from '~/hooks/useViewingArticle'
import useSubStore from '~/hooks/useSubStore'

type TRes = {
  previous: TArticle | null
  next: TArticle | null
}

export default (): TRes => {
  const articles = useSubStore('articles')
  const curThread = useViewingThread()
  const { article: viewingArticle } = useViewingArticle()

  if (!includes(curThread, values(ARTICLE_THREAD)) || !viewingArticle?.id) {
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
