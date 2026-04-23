import type { TDocCoverLayout, TDocFAQLayout, TFAQSection } from '~/spec'
import useArticle from '~/stores/article/hooks'
import useDashboard from '~/stores/dashboard/hooks'

type TRet = {
  isArticleLayout: boolean
  isFAQArticleLayout: boolean
  layout: TDocCoverLayout
  faqLayout: TDocFAQLayout
  gotoDetailLayout: () => void
  gotoFAQDetailLayout: () => void
  back2Layout: () => void
  faqSections: TFAQSection[]
}

export default function useLogic(): TRet {
  const dashboard = useDashboard()
  const article$ = useArticle()

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
    faqSections: [],
    gotoDetailLayout,
    gotoFAQDetailLayout,
    back2Layout,
  }
}
