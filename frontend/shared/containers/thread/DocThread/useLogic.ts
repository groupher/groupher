import type { TDocFAQLayout, TDocLayout, TFAQSection } from '~/spec'

import useSubStore from '~/hooks/useSubStore'

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
  const dashboard = useSubStore('dashboard')
  const viewing = useSubStore('viewing')

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
