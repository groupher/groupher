import { includes, values } from 'ramda'
import { useMemo } from 'react'

import { SITE_URL } from '~/config'
import { ARTICLE_THREAD } from '~/const/thread'
import useGeneral from '~/hooks/useGeneral'
import type { TArticle } from '~/spec'

type TRet = {
  article: TArticle
  articleLink: string
}

export const parseArticleLink = (article: TArticle): string => {
  if (!article?.meta?.thread || !article.community) return ''

  const { meta, community, innerId } = article
  const thread = meta.thread.toLowerCase()

  return `${SITE_URL}/${community.slug}/${thread}/${innerId}`
}

export default (): TRet => {
  const store = useGeneral()

  const article = useMemo((): TArticle => {
    const curThread = store.activeThread

    if (includes(curThread, values(ARTICLE_THREAD))) {
      return store[curThread]
    }
    return {}
  }, [store])

  return {
    article,
    articleLink: parseArticleLink(article),
  }
}
