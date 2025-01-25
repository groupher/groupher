import { useMemo } from 'react'
import { values, includes } from 'ramda'

import { SITE_URL } from '~/config'
import type { TArticle } from '~/spec'
import { ARTICLE_THREAD } from '~/const/thread'

import useSubStore from '~/hooks/useSubStore'

type TRet = {
  article: TArticle
  articleLink: string
}

export const parseArticleLink = (article: TArticle): string => {
  if (!article?.meta?.thread) return ''

  const { meta, originalCommunity, innerId } = article
  const community = originalCommunity.slug
  const thread = meta.thread.toLowerCase()

  return `${SITE_URL}/${community}/${thread}/${innerId}`
}

export default (): TRet => {
  const store = useSubStore('viewing')

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
