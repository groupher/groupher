import type { FC } from 'react'

import { DOC_FAQ_LAYOUT } from '~/const/layout'
import useTrans from '~/hooks/useTrans'
import type { TDocFAQLayout } from '~/spec'

import useSalon, { cnMerge } from '../../salon/layout/doc_layout/faq_template'

type TProps = {
  layout: TDocFAQLayout
}

const COLLAPSE_ITEMS = [
  { title: 'w-16', body1: 'w-24', body2: 'w-20' },
  { title: 'w-16', body1: 'w-20', body2: 'w-14' },
  { title: 'w-20', body1: 'w-14', body2: 'w-16' },
] as const

const FLAT_ROWS = [
  [
    { title: 'w-10', body1: 'w-16', body2: 'w-12' },
    { title: 'w-12', body1: 'w-16', body2: 'w-12' },
    { title: 'w-9', body1: 'w-16', body2: 'w-12' },
  ],
  [
    { title: 'w-8', body1: 'w-12', body2: 'w-8' },
    { title: 'w-14', body1: 'w-10', body2: 'w-10' },
  ],
] as const

const LEFT_RIGHT_ITEMS = [
  { title: 'w-16', body1: 'w-24', body2: 'w-20' },
  { title: 'w-16', body1: 'w-20', body2: 'w-14' },
  { title: 'w-20', body1: 'w-14', body2: 'w-16' },
] as const

const FaqTemplate: FC<TProps> = ({ layout }) => {
  const s = useSalon()
  const { t } = useTrans()

  if (layout === DOC_FAQ_LAYOUT.COLLAPSE) {
    return (
      <div className={s.block}>
        <div className={s.titleWrap}>
          <div className={s.faqTitle}>{t('dsb.layout.doc.faq.label')}</div>
        </div>

        <div className={s.collapseList}>
          {COLLAPSE_ITEMS.map((item) => (
            <div key={`${item.title}-${item.body1}-${item.body2}`} className={s.collapseItem}>
              <div className={cnMerge(s.bar, item.title)} />
              <div className={cnMerge(s.bar, 'h-1', item.body1, 'opacity-20')} />
              <div className={cnMerge(s.bar, 'h-1', item.body2, 'opacity-20')} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (layout === DOC_FAQ_LAYOUT.LEFT_RIGHT) {
    return (
      <div className={s.block}>
        <div className={s.leftRightMain}>
          <div className={s.leftRightSide}>
            <div className={s.faqTitle}>{t('dsb.layout.doc.faq.label')}</div>
            <div className={cnMerge(s.bar, 'h-1', 'w-16', 'opacity-20')} />
            <div className={cnMerge(s.bar, 'h-1', 'w-12', 'opacity-10')} />
          </div>

          <div className={s.leftRightList}>
            {LEFT_RIGHT_ITEMS.map((item) => (
              <div key={`${item.title}-${item.body1}-${item.body2}`} className={s.leftRightItem}>
                <div className={cnMerge(s.bar, item.title)} />
                <div className={cnMerge(s.bar, 'h-1', item.body1, 'opacity-20')} />
                <div className={cnMerge(s.bar, 'h-1', item.body2, 'opacity-20')} />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={s.block}>
      <div className={s.titleWrap}>
        <div className={s.faqTitle}>{t('dsb.layout.doc.faq.label')}</div>
      </div>

      <div className={s.flatList}>
        {FLAT_ROWS.map((row) => (
          <div key={row.map((item) => item.title).join('|')} className={s.flatRow}>
            {row.map((item) => (
              <div key={`${item.title}-${item.body1}-${item.body2}`} className={s.flatBox}>
                <div className={cnMerge(s.bar, item.title)} />
                <div className={cnMerge(s.bar, 'h-1', item.body1, 'opacity-20')} />
                <div className={cnMerge(s.bar, 'h-1', item.body2, 'opacity-20')} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default FaqTemplate
