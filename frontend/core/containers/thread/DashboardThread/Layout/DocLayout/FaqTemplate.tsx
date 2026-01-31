import type { FC } from 'react'
import { DOC_FAQ_LAYOUT } from '~/const/layout'
import type { TDocFAQLayout } from '~/spec'

import useSalon, { cnMerge } from '../../salon/layout/doc_layout/faq_template'

type TProps = {
  layout: TDocFAQLayout
}

const FaqTemplate: FC<TProps> = ({ layout }) => {
  const s = useSalon()

  if (layout === DOC_FAQ_LAYOUT.COLLAPSE) {
    return (
      <div className={s.block}>
        <div className={cnMerge(s.faqTitle, 'top-5 left-28')}>常见问题</div>
        <div className={cnMerge(s.bar, 'h-1.5 top-14 left-24 w-16')} />
        <div className={cnMerge(s.bar, 'h-1 top-16 mt-2 left-24 w-24 opacity-20')} />
        <div className={cnMerge(s.bar, 'h-1 top-20 mt-1.5 left-24 w-20 opacity-20')} />

        <div className={cnMerge(s.bar, 'h-1.5 top-24 mt-2 left-24 w-16')} />
        <div className={cnMerge(s.bar, 'h-1 top-28 mt-2 left-24 w-20 opacity-20')} />
        <div className={cnMerge(s.bar, 'h-1 top-32 mt-1.5 left-24 w-14 opacity-20')} />

        <div className={cnMerge(s.bar, 'h-1.5 top-36 mt-2 left-24 w-20')} />
        <div className={cnMerge(s.bar, 'h-1.5 top-40 mt-2.5 left-24 w-14')} />
        <div className={cnMerge(s.bar, 'h-1.5 top-44 mt-2.5 left-24 w-16 opacity-30')} />
      </div>
    )
  }

  if (layout === DOC_FAQ_LAYOUT.LEFT_RIGHT) {
    return (
      <div className={s.block}>
        <div className={cnMerge(s.faqTitle, 'top-8 left-7 -ml-1')}>常见问题</div>
        <div className={cnMerge(s.bar, 'h-1.5 top-14 left-6 w-16 opacity-20')} />
        <div className={cnMerge(s.bar, 'h-1.5 top-16 left-6 w-12 mt-1 opacity-10')} />

        <div className={cnMerge(s.bar, 'h-1.5 top-9 left-32 w-16')} />
        <div className={cnMerge(s.bar, 'h-1 top-12 mt-2 left-32 w-24 opacity-20')} />
        <div className={cnMerge(s.bar, 'h-1 top-16 mt-1.5 left-32 w-20 opacity-20')} />

        <div className={cnMerge(s.bar, 'h-1.5 top-20 mt-2 left-32 w-16')} />
        <div className={cnMerge(s.bar, 'h-1 top-24 mt-2 left-32 w-20 opacity-20')} />
        <div className={cnMerge(s.bar, 'h-1 top-28 mt-1.5 left-32 w-14 opacity-20')} />

        <div className={cnMerge(s.bar, 'h-1.5 top-32 mt-2 left-32 w-20')} />
        <div className={cnMerge(s.bar, 'h-1.5 top-36 mt-2.5 left-32 w-14')} />
        <div className={cnMerge(s.bar, 'h-1.5 top-40 mt-2.5 left-32 w-16 opacity-20')} />
      </div>
    )
  }

  return (
    <div className={s.block}>
      <div className={cnMerge(s.faqTitle, 'top-5 left-28 -ml-1')}>常见问题</div>

      <div className={s.list}>
        <div className={s.box}>
          <div className={cnMerge(s.bar, 'h-1.5 top-0 left-3 w-10')} />
          <div className={cnMerge(s.bar, 'h-1 top-2 mt-2 left-3 w-16 opacity-20')} />
          <div className={cnMerge(s.bar, 'h-1 top-4 mt-2.5 left-3 w-12 opacity-20')} />
        </div>

        <div className={s.box}>
          <div className={cnMerge(s.bar, 'h-1.5 top-0 left-3 w-12')} />
          <div className={cnMerge(s.bar, 'h-1 top-2 mt-2 left-3 w-16 opacity-20')} />
          <div className={cnMerge(s.bar, 'h-1 top-4 mt-2.5 left-3 w-12 opacity-20')} />
        </div>

        <div className={s.box}>
          <div className={cnMerge(s.bar, 'h-1.5 top-0 left-3 w-9')} />
          <div className={cnMerge(s.bar, 'h-1 top-2 mt-2 left-3 w-16 opacity-20')} />
          <div className={cnMerge(s.bar, 'h-1 top-4 mt-2.5 left-3 w-12 opacity-20')} />
        </div>

        <div className={s.box}>
          <div className={cnMerge(s.bar, 'h-1.5 top-0 left-3 w-8')} />
          <div className={cnMerge(s.bar, 'h-1 top-2 mt-2 left-3 w-16 opacity-20')} />
          <div className={cnMerge(s.bar, 'h-1 top-4 mt-2.5 left-3 w-12 opacity-20')} />
        </div>

        <div className={s.box}>
          <div className={cnMerge(s.bar, 'h-1.5 top-0 left-3 w-14')} />
          <div className={cnMerge(s.bar, 'h-1 top-2 mt-2 left-3 w-20 opacity-20')} />
          <div className={cnMerge(s.bar, 'h-1 top-4 mt-2.5 left-3 w-12 opacity-20')} />
        </div>
      </div>
    </div>
  )
}

export default FaqTemplate
