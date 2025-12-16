import useDashboard from '~/hooks/useDashboard'
import useGeneral from '~/hooks/useGeneral'

import type { TDocFAQLayout, TDocLayout, TFAQSection } from '~/spec'

type TRet = {
  isArticleLayout: boolean
  isFAQArticleLayout: boolean
  layout: TDocLayout
  faqLayout: TDocFAQLayout
  gotoDetailLayout: () => void
  gotoFAQDetailLayout: () => void
  back2Layout: () => void
  faqSections: TFAQSection[]
}

export default (): TRet => {
  const dashboard = useDashboard()
  const viewing = useGeneral()

  const gotoDetailLayout = (): void => {
    viewing.commit({ isArticleLayout: true, isFAQArticleLayout: false })
  }

  const gotoFAQDetailLayout = (): void => {
    // store.mark({ isArticleLayout: true, isFAQArticleLayout: true })
    viewing.commit({ isArticleLayout: true, isFAQArticleLayout: true })
  }

  const back2Layout = (): void => {
    viewing.commit({ isArticleLayout: false, isFAQArticleLayout: false })
  }

  return {
    isArticleLayout: viewing.isArticleLayout,
    isFAQArticleLayout: viewing.isFAQArticleLayout,
    layout: dashboard.docLayout,
    faqLayout: dashboard.docFaqLayout,
    faqSections: [],
    gotoDetailLayout,
    gotoFAQDetailLayout,
    back2Layout,
  }
}
