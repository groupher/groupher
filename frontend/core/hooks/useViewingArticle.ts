import { SITE_URL } from '~/config'
import type { TArticle } from '~/spec'
import useArticle from '~/stores/article/hooks'
import { thread2Path } from '~/utils/thread'

type TRet = {
  article: TArticle
  articleLink: string
}

export const parseArticleLink = (article: TArticle): string => {
  if (!article?.meta?.thread || !article.community) return ''

  const { meta, community, innerId } = article
  const thread = thread2Path(meta.thread)

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
