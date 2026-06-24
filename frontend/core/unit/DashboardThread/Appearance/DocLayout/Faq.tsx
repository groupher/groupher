import { DOC_FAQ_LAYOUT } from '~/const/layout'
import useTrans from '~/hooks/useTrans'
import CheckLabel from '~/widgets/CheckLabel'

import { FIELD } from '../../constant'
import useDoc from '../../logic/useDoc'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import FaqTemplate from './FaqTemplate'
import useSalon, { cn } from './salon'

export default function DocFaqLayout() {
  const s = useSalon()
  const { t } = useTrans()

  const { docFaqLayout, isFaqTouched, edit } = useDoc()

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title={t('dsb.appearance.doc.faq.title')}
        desc={t('dsb.appearance.doc.faq.desc')}
        detailText={t('dsb.appearance.view_example')}
        touched={isFaqTouched}
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
            title={t('dsb.appearance.doc.faq.option.collapse')}
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
            title={t('dsb.appearance.doc.faq.option.flat')}
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
            title={t('dsb.appearance.doc.faq.option.left_right')}
            active={docFaqLayout === DOC_FAQ_LAYOUT.LEFT_RIGHT}
            top={4}
          />
        </button>
      </div>
      <SavingBar isTouched={isFaqTouched} field={FIELD.DOC_FAQ_LAYOUT} top={10} />
    </div>
  )
}
