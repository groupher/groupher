/* *
 * DocThread
 */

import { DOC_COVER_LAYOUT } from '~/const/layout'

import FaqList from '~/unit/FaqList'
import ArticleLayout from './ArticleLayout'
import BriefCardsLayout from './BriefCardsLayout'
import CoverCardsLayout from './CoverCardsLayout'
import OutlineColumnsLayout from './OutlineColumnsLayout'
import OutlineTocLayout from './OutlineTocLayout'
import StackCardsLayout from './StackCardsLayout'
import useSalon from './salon'
import TileCardsLayout from './TileCardsLayout'
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
      <CoverCardsLayout />

      {/* <OutlineColumnsLayout /> */}
      {/* <OutlineTocLayout /> */}
      {/* <BriefCardsLayout /> */}
      {/* <TileCardsLayout /> */}
      {/* <CoverCardsLayout /> */}

      {layout === DOC_COVER_LAYOUT.OUTLINE_COLUMNS && <OutlineColumnsLayout />}
      {layout === DOC_COVER_LAYOUT.OUTLINE_TOC && <OutlineTocLayout />}
      {layout === DOC_COVER_LAYOUT.BRIEF_CARDS && <BriefCardsLayout />}
      {layout === DOC_COVER_LAYOUT.COVER_CARDS && <CoverCardsLayout />}
      {layout === DOC_COVER_LAYOUT.TILE_CARDS && <TileCardsLayout />}
      {layout === DOC_COVER_LAYOUT.STACK_CARDS && <StackCardsLayout />}

      <div className={s.divider} />

      <div className={s.faqs}>
        <FaqList layout={faqLayout} sections={faqSections} />
      </div>
    </div>
  )
}
