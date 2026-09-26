import { SITE_URL } from '~/config'
import type { TArticle, TArticleStats, TArticleViewerState } from '~/spec'
import useArticle from '~/stores/article/hooks'
import { thread2Path } from '~/utils/thread'

type TRet = {
  article: TArticle
  stats: TArticleStats | null
  viewerState: TArticleViewerState
  articleLink: string
}

const parseArticleLink = (article: TArticle): string => {
  if (!article?.meta?.thread || !article.community) return ''

  const { meta, community, innerId } = article
  const thread = thread2Path(meta.thread)

  return `${SITE_URL}/${community.slug}/${thread}/${innerId}`
}

/** Exposes viewing article state and actions through the shared React hook boundary. */
export default function useViewingArticle(): TRet {
  const article$ = useArticle()
  const { article, stats, viewerState } = article$

  return {
    article,
    stats,
    viewerState,
    articleLink: parseArticleLink(article),
  }
}
