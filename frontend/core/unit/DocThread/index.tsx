/* *
 * DocThread
 */

import { DOC_LAYOUT } from '~/const/layout'

import FaqList from '~/unit/FaqList'
import ArticleLayout from './ArticleLayout'
import CardsLayout from './CardsLayout'
import ListsLayout from './ListsLayout'
import OutlineLayout from './OutlineLayout'
import useSalon from './salon'
import useLogic from './useLogic'

export default function DocThread() {
  const s = useSalon()
  const { isArticleLayout, layout, faqLayout, faqSections } = useLogic()
  // return <ArticleLayout />

  if (isArticleLayout) {
    return <ArticleLayout />
  }

  return (
    <div className={s.wrapper}>
      {layout === DOC_LAYOUT.OUTLINE && <OutlineLayout />}
      {layout === DOC_LAYOUT.LISTS && <ListsLayout />}
      {layout === DOC_LAYOUT.CARDS && <CardsLayout />}

      <div className={s.divider} />

      <div className={s.faqs}>
        <FaqList layout={faqLayout} sections={faqSections} />
      </div>
    </div>
  )
}
