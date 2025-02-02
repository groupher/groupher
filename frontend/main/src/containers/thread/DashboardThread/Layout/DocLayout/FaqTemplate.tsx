import type { FC } from 'react'

import type { TDocFAQLayout } from '~/spec'
import { DOC_FAQ_LAYOUT } from '~/const/layout'

import useSalon, { cn } from '../../salon/layout/doc_layout/faq_template'

type TProps = {
  layout: TDocFAQLayout
}

const FaqTemplate: FC<TProps> = ({ layout }) => {
  const s = useSalon()

  if (layout === DOC_FAQ_LAYOUT.COLLAPSE) {
    return (
      <div className={s.block}>
        <div className={cn(s.faqTitle, 'top-5 left-28')}>常见问题</div>
        <div className={cn(s.bar, 'h-1.5 top-14 left-24 w-16')} />
        <div className={cn(s.bar, 'h-1 top-16 mt-2 left-24 w-24 opacity-20')} />
        <div className={cn(s.bar, 'h-1 top-20 mt-1.5 left-24 w-20 opacity-20')} />

        <div className={cn(s.bar, 'h-1.5 top-24 mt-2 left-24 w-16')} />
        <div className={cn(s.bar, 'h-1 top-28 mt-2 left-24 w-20 opacity-20')} />
        <div className={cn(s.bar, 'h-1 top-32 mt-1.5 left-24 w-14 opacity-20')} />

        <div className={cn(s.bar, 'h-1.5 top-36 mt-2 left-24 w-20')} />
        <div className={cn(s.bar, 'h-1.5 top-40 mt-2.5 left-24 w-14')} />
        <div className={cn(s.bar, 'h-1.5 top-44 mt-2.5 left-24 w-16 opacity-30')} />
      </div>
    )
  }

  return (
    <div className={s.block}>
      <div className={cn(s.faqTitle, 'top-5 left-28 -ml-1')}>常见问题</div>

      <div className={s.list}>
        <div className={s.box}>
          <div className={cn(s.bar, 'h-1.5 top-0 left-3 w-10')} />
          <div className={cn(s.bar, 'h-1 top-2 mt-2 left-3 w-16 opacity-20')} />
          <div className={cn(s.bar, 'h-1 top-4 mt-2.5 left-3 w-12 opacity-20')} />
        </div>

        <div className={s.box}>
          <div className={cn(s.bar, 'h-1.5 top-0 left-3 w-12')} />
          <div className={cn(s.bar, 'h-1 top-2 mt-2 left-3 w-16 opacity-20')} />
          <div className={cn(s.bar, 'h-1 top-4 mt-2.5 left-3 w-12 opacity-20')} />
        </div>

        <div className={s.box}>
          <div className={cn(s.bar, 'h-1.5 top-0 left-3 w-9')} />
          <div className={cn(s.bar, 'h-1 top-2 mt-2 left-3 w-16 opacity-20')} />
          <div className={cn(s.bar, 'h-1 top-4 mt-2.5 left-3 w-12 opacity-20')} />
        </div>

        <div className={s.box}>
          <div className={cn(s.bar, 'h-1.5 top-0 left-3 w-8')} />
          <div className={cn(s.bar, 'h-1 top-2 mt-2 left-3 w-16 opacity-20')} />
          <div className={cn(s.bar, 'h-1 top-4 mt-2.5 left-3 w-12 opacity-20')} />
        </div>

        <div className={s.box}>
          <div className={cn(s.bar, 'h-1.5 top-0 left-3 w-14')} />
          <div className={cn(s.bar, 'h-1 top-2 mt-2 left-3 w-20 opacity-20')} />
          <div className={cn(s.bar, 'h-1 top-4 mt-2.5 left-3 w-12 opacity-20')} />
        </div>
      </div>
    </div>
  )
}

export default FaqTemplate
