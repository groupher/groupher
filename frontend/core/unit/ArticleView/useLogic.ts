import type { TArticle, TArticleStats, TArticleViewerState } from '~/spec'
import useArticle from '~/stores/article/hooks'

type TRet = {
  article: TArticle
  stats: TArticleStats | null
  viewerState: TArticleViewerState
  loading: boolean
}

/** Exposes logic state and actions through the shared React hook boundary. */
export default function useLogic(): TRet {
  const { article, stats, viewerState } = useArticle()

  return {
    article,
    stats,
    viewerState,
    loading: !article,
  }
}
