import { SITE_URL } from '~/config'
import useArticle from '~/hooks/useArticle'
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

export default function useViewingArticle(): TRet {
  const article$ = useArticle()
  const { article } = article$

  return {
    article,
    articleLink: parseArticleLink(article),
  }
}
