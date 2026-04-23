import { DOC_COVER_LAYOUT, DOC_FAQ_LAYOUT } from '~/const/layout'
import useTrans from '~/hooks/useTrans'
import CheckLabel from '~/widgets/CheckLabel'

import { FIELD } from '../../constant'
import useDoc from '../../logic/useDoc'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import useSalon, { cn } from '../../salon/layout/doc_layout'
import BriefCardsLayout from './BriefCardsLayout'
import CoverCardsLayout from './CoverCardsLayout'
import FaqTemplate from './FaqTemplate'
import OutlineColumnsLayout from './OutlineColumnsLayout'
import OutlineTocLayout from './OutlineTocLayout'
import StackCardsLayout from './StackCardsLayout'
import TileCardsLayout from './TileCardsLayout'

export default function DocLayout() {
  const s = useSalon()
  const { t } = useTrans()

  const { docCoverLayout, docFaqLayout, isTouched, isFaqTouched, edit } = useDoc()

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title={t('dsb.layout.doc.title')}
        desc={t('dsb.layout.doc.desc')}
        detailText={t('dsb.layout.view_example')}
      />
      <div className={s.select}>
        <button
          type='button'
          className={s.layout}
          aria-pressed={docCoverLayout === DOC_COVER_LAYOUT.OUTLINE_COLUMNS}
          onClick={() => edit(DOC_COVER_LAYOUT.OUTLINE_COLUMNS, FIELD.DOC_COVER_LAYOUT)}
        >
          <div
            className={cn(
              s.block,
              docCoverLayout === DOC_COVER_LAYOUT.OUTLINE_COLUMNS && s.blockActive,
            )}
          >
            <OutlineColumnsLayout />
          </div>
          <CheckLabel
            title={t('dsb.layout.doc.option.outline_columns')}
            active={docCoverLayout === DOC_COVER_LAYOUT.OUTLINE_COLUMNS}
            top={4}
          />
        </button>

        <button
          type='button'
          className={s.layout}
          aria-pressed={docCoverLayout === DOC_COVER_LAYOUT.OUTLINE_TOC}
          onClick={() => edit(DOC_COVER_LAYOUT.OUTLINE_TOC, FIELD.DOC_COVER_LAYOUT)}
        >
          <div
            className={cn(
              s.block,
              docCoverLayout === DOC_COVER_LAYOUT.OUTLINE_TOC && s.blockActive,
            )}
          >
            <OutlineTocLayout />
          </div>
          <CheckLabel
            title={t('dsb.layout.doc.option.outline_toc')}
            active={docCoverLayout === DOC_COVER_LAYOUT.OUTLINE_TOC}
            top={4}
          />
        </button>

        <button
          type='button'
          className={s.layout}
          aria-pressed={docCoverLayout === DOC_COVER_LAYOUT.BRIEF_CARDS}
          onClick={() => edit(DOC_COVER_LAYOUT.BRIEF_CARDS, FIELD.DOC_COVER_LAYOUT)}
        >
          <div
            className={cn(
              s.block,
              docCoverLayout === DOC_COVER_LAYOUT.BRIEF_CARDS && s.blockActive,
            )}
          >
            <BriefCardsLayout />
          </div>
          <CheckLabel
            title={t('dsb.layout.doc.option.brief_cards')}
            active={docCoverLayout === DOC_COVER_LAYOUT.BRIEF_CARDS}
            top={4}
          />
        </button>

        <button
          type='button'
          className={s.layout}
          aria-pressed={docCoverLayout === DOC_COVER_LAYOUT.TILE_CARDS}
          onClick={() => edit(DOC_COVER_LAYOUT.TILE_CARDS, FIELD.DOC_COVER_LAYOUT)}
        >
          <div
            className={cn(s.block, docCoverLayout === DOC_COVER_LAYOUT.TILE_CARDS && s.blockActive)}
          >
            <TileCardsLayout />
          </div>
          <CheckLabel
            title={t('dsb.layout.doc.option.tile_cards')}
            active={docCoverLayout === DOC_COVER_LAYOUT.TILE_CARDS}
            top={4}
          />
        </button>

        <button
          type='button'
          className={s.layout}
          aria-pressed={docCoverLayout === DOC_COVER_LAYOUT.COVER_CARDS}
          onClick={() => edit(DOC_COVER_LAYOUT.COVER_CARDS, FIELD.DOC_COVER_LAYOUT)}
        >
          <div
            className={cn(
              s.block,
              docCoverLayout === DOC_COVER_LAYOUT.COVER_CARDS && s.blockActive,
            )}
          >
            <CoverCardsLayout />
          </div>
          <CheckLabel
            title={t('dsb.layout.doc.option.cover_cards')}
            active={docCoverLayout === DOC_COVER_LAYOUT.COVER_CARDS}
            top={4}
          />
        </button>

        <button
          type='button'
          className={s.layout}
          aria-pressed={docCoverLayout === DOC_COVER_LAYOUT.STACK_CARDS}
          onClick={() => edit(DOC_COVER_LAYOUT.STACK_CARDS, FIELD.DOC_COVER_LAYOUT)}
        >
          <div
            className={cn(
              s.block,
              docCoverLayout === DOC_COVER_LAYOUT.STACK_CARDS && s.blockActive,
            )}
          >
            <StackCardsLayout />
          </div>
          <CheckLabel
            title={t('dsb.layout.doc.option.stack_cards')}
            active={docCoverLayout === DOC_COVER_LAYOUT.STACK_CARDS}
            top={4}
          />
        </button>
      </div>
      <SavingBar isTouched={isTouched} field={FIELD.DOC_COVER_LAYOUT} top={10} />

      <div className={s.divider} />

      <SectionLabel
        title={t('dsb.layout.doc.faq.title')}
        desc={t('dsb.layout.doc.faq.desc')}
        detailText={t('dsb.layout.view_example')}
      />
      <div className={s.select}>
        <button
          type='button'
          className={s.layout}
          aria-pressed={docFaqLayout === DOC_FAQ_LAYOUT.COLLAPSE}
          onClick={() => edit(DOC_FAQ_LAYOUT.COLLAPSE, FIELD.DOC_FAQ_LAYOUT)}
        >
          <div className={cn(s.block, docFaqLayout === DOC_FAQ_LAYOUT.COLLAPSE && s.blockActive)}>
            <FaqTemplate layout={DOC_FAQ_LAYOUT.COLLAPSE} />
          </div>
          <CheckLabel
            title={t('dsb.layout.doc.faq.option.collapse')}
            active={docFaqLayout === DOC_FAQ_LAYOUT.COLLAPSE}
            top={4}
          />
        </button>
        <button
          type='button'
          className={s.layout}
          aria-pressed={docFaqLayout === DOC_FAQ_LAYOUT.FLAT}
          onClick={() => edit(DOC_FAQ_LAYOUT.FLAT, FIELD.DOC_FAQ_LAYOUT)}
        >
          <div className={cn(s.block, docFaqLayout === DOC_FAQ_LAYOUT.FLAT && s.blockActive)}>
            <FaqTemplate layout={DOC_FAQ_LAYOUT.FLAT} />
          </div>
          <CheckLabel
            title={t('dsb.layout.doc.faq.option.flat')}
            active={docFaqLayout === DOC_FAQ_LAYOUT.FLAT}
            top={4}
          />
        </button>
        <button
          type='button'
          className={s.layout}
          aria-pressed={docFaqLayout === DOC_FAQ_LAYOUT.LEFT_RIGHT}
          onClick={() => edit(DOC_FAQ_LAYOUT.LEFT_RIGHT, FIELD.DOC_FAQ_LAYOUT)}
        >
          <div className={cn(s.block, docFaqLayout === DOC_FAQ_LAYOUT.LEFT_RIGHT && s.blockActive)}>
            <FaqTemplate layout={DOC_FAQ_LAYOUT.LEFT_RIGHT} />
          </div>
          <CheckLabel
            title={t('dsb.layout.doc.faq.option.left_right')}
            active={docFaqLayout === DOC_FAQ_LAYOUT.LEFT_RIGHT}
            top={4}
          />
        </button>
      </div>
      <SavingBar isTouched={isFaqTouched} field={FIELD.DOC_FAQ_LAYOUT} top={10} />
    </div>
  )
}
