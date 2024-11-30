/* *
 * DocThread
 */

import useMobileDetect from '@groupher/use-mobile-detect-hook'

import { DOC_LAYOUT } from '~/const/layout'

import { Divider } from '~/widgets/Common'
import FaqList from '~/widgets/FaqList'

import BlocksLayout from './BlocksLayout'
import ListsLayout from './ListsLayout'
import CardsLayout from './CardsLayout'
import ArticleLayout from './ArticleLayout'

import useLogic from './useLogic'
import useSalon from './salon'

export default () => {
  const s = useSalon()
  const { isArticleLayout, layout, faqLayout, faqSections } = useLogic()
  const { isMobile } = useMobileDetect()

  // return <ArticleLayout />

  if (isArticleLayout) {
    return <ArticleLayout />
  }

  return (
    <div className={s.wrapper}>
      {layout === DOC_LAYOUT.BLOCKS && <BlocksLayout />}
      {layout === DOC_LAYOUT.LISTS && <ListsLayout />}
      {layout === DOC_LAYOUT.CARDS && <CardsLayout />}

      <Divider top={50} bottom={80} width={isMobile ? '90%' : '100%'} />

      <div className={s.faqs}>
        <FaqList layout={faqLayout} sections={faqSections} />
      </div>
    </div>
  )
}
