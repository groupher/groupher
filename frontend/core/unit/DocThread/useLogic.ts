import useQuery from '~/hooks/useQuery'
import type { TDocCoverLayout, TDocFAQLayout, TDocFaq } from '~/spec'
import useArticle from '~/stores/article/hooks'
import useCommunity from '~/stores/community/hooks'
import useDashboard from '~/stores/dashboard/hooks'
import { DOC_COVER_VIEW } from '~/unit/DocCovers/constant'
import S from '~/unit/DocCovers/schema'
import type { TDocCoversData } from '~/unit/DocCovers/spec'

const EMPTY_DOC_COVERS: TDocCoversData = {
  groups: [],
  pinnedItems: [],
}

type TRet = {
  isArticleLayout: boolean
  isFAQArticleLayout: boolean
  layout: TDocCoverLayout
  faqLayout: TDocFAQLayout
  gotoDetailLayout: () => void
  gotoFAQDetailLayout: () => void
  back2Layout: () => void
  docFaq: TDocFaq
  docCoversData: TDocCoversData
}

export default function useLogic(): TRet {
  const dashboard = useDashboard()
  const article$ = useArticle()
  const { slug: community } = useCommunity()
  const { data } = useQuery<{ docCover?: TDocCoversData }>(S.docCover, {
    community,
    view: DOC_COVER_VIEW.PUBLIC,
  })
  const docCoversData = data?.docCover ?? EMPTY_DOC_COVERS

  const gotoDetailLayout = (): void => {
    article$.commit({ isArticleLayout: true, isFAQArticleLayout: false })
  }

  const gotoFAQDetailLayout = (): void => {
    // store.mark({ isArticleLayout: true, isFAQArticleLayout: true })
    article$.commit({ isArticleLayout: true, isFAQArticleLayout: true })
  }

  const back2Layout = (): void => {
    article$.commit({ isArticleLayout: false, isFAQArticleLayout: false })
  }

  return {
    isArticleLayout: article$.isArticleLayout,
    isFAQArticleLayout: article$.isFAQArticleLayout,
    layout: dashboard.docCoverLayout,
    faqLayout: dashboard.docFaqLayout,
    docFaq: dashboard.docFaq,
    docCoversData,
    gotoDetailLayout,
    gotoFAQDetailLayout,
    back2Layout,
  }
}
