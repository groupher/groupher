import { DOC_COVER_LAYOUT } from '~/const/layout'
import useTrans from '~/hooks/useTrans'
import CheckLabel from '~/widgets/CheckLabel'

import { FIELD } from '../../constant'
import useDoc from '../../logic/useDoc'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import BriefCardsLayout from './BriefCardsLayout'
import CoverCardsLayout from './CoverCardsLayout'
import OutlineColumnsLayout from './OutlineColumnsLayout'
import OutlineTocLayout from './OutlineTocLayout'
import useSalon, { cn } from './salon'
import StackCardsLayout from './StackCardsLayout'
import TileCardsLayout from './TileCardsLayout'

export default function DocCoverLayout() {
  const s = useSalon()
  const { t } = useTrans()

  const { docCoverLayout, isTouched, edit } = useDoc()

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title={t('dsb.appearance.doc.title')}
        desc={t('dsb.appearance.doc.desc')}
        detailText={t('dsb.appearance.view_example')}
        touched={isTouched}
      />
      <div className={s.select}>
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
            title={t('dsb.appearance.doc.option.stack_cards')}
            active={docCoverLayout === DOC_COVER_LAYOUT.STACK_CARDS}
            top={4}
          />
        </button>

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
            title={t('dsb.appearance.doc.option.outline_columns')}
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
            title={t('dsb.appearance.doc.option.outline_toc')}
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
            title={t('dsb.appearance.doc.option.brief_cards')}
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
            title={t('dsb.appearance.doc.option.tile_cards')}
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
            title={t('dsb.appearance.doc.option.cover_cards')}
            active={docCoverLayout === DOC_COVER_LAYOUT.COVER_CARDS}
            top={4}
          />
        </button>
      </div>

      <SavingBar isTouched={isTouched} field={FIELD.DOC_COVER_LAYOUT} top={10} />
    </div>
  )
}
