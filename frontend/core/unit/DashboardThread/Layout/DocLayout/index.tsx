import { DOC_FAQ_LAYOUT, DOC_LAYOUT } from '~/const/layout'
import useTrans from '~/hooks/useTrans'
import CheckLabel from '~/widgets/CheckLabel'

import { FIELD } from '../../constant'
import useDoc from '../../logic/useDoc'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import useSalon, { cn } from '../../salon/layout/doc_layout'
import FaqTemplate from './FaqTemplate'
import MainTemplate from './MainTemplate'

export default function DocLayout() {
  const s = useSalon()
  const { t } = useTrans()

  const { docLayout, docFaqLayout, isTouched, isFaqTouched, edit } = useDoc()

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
          aria-pressed={docLayout === DOC_LAYOUT.OUTLINE}
          onClick={() => edit(DOC_LAYOUT.OUTLINE, FIELD.DOC_LAYOUT)}
        >
          <div className={cn(s.block, docLayout === DOC_LAYOUT.OUTLINE && s.blockActive)}>
            <MainTemplate layout={DOC_LAYOUT.OUTLINE} />
          </div>
          <CheckLabel
            title={t('dsb.layout.doc.option.outline')}
            active={docLayout === DOC_LAYOUT.OUTLINE}
            top={4}
          />
        </button>

        <button
          type='button'
          className={s.layout}
          aria-pressed={docLayout === DOC_LAYOUT.LISTS}
          onClick={() => edit(DOC_LAYOUT.LISTS, FIELD.DOC_LAYOUT)}
        >
          <div className={cn(s.block, docLayout === DOC_LAYOUT.LISTS && s.blockActive)}>
            <MainTemplate layout={DOC_LAYOUT.LISTS} />
          </div>
          <CheckLabel
            title={t('dsb.layout.doc.option.lists')}
            active={docLayout === DOC_LAYOUT.LISTS}
            top={4}
          />
        </button>

        <button
          type='button'
          className={s.layout}
          aria-pressed={docLayout === DOC_LAYOUT.CARDS}
          onClick={() => edit(DOC_LAYOUT.CARDS, FIELD.DOC_LAYOUT)}
        >
          <div
            className={cn(
              s.block,
              'py-2 pl-2.5 pr-0',
              docLayout === DOC_LAYOUT.CARDS && s.blockActive,
            )}
          >
            <MainTemplate layout={DOC_LAYOUT.CARDS} />
          </div>
          <CheckLabel
            title={t('dsb.layout.doc.option.cards')}
            active={docLayout === DOC_LAYOUT.CARDS}
            top={4}
          />
        </button>
      </div>
      <SavingBar isTouched={isTouched} field={FIELD.DOC_LAYOUT} top={10} />

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
