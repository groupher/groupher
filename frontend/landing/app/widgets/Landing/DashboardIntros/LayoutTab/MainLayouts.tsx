import type { FC } from 'react'

import type { TColorName } from '~/spec'

import useSalon, { cn } from '../../salon/dashboard_intros/layout_tab/main_layouts'

type TProps = {
  primaryColor: TColorName
}

const MainLayouts: FC<TProps> = ({ primaryColor }) => {
  const s = useSalon({ color: primaryColor })

  return (
    <div className={s.wrapper}>
      <div className={s.layouts}>
        <div className={cn(s.card, s.cardInactive)}>
          <div className={cn(s.bar, 'top-2 left-2 w-6')} />
          <div className={cn(s.bar, 'top-2 left-10 w-10')} />
          <div className={cn(s.bar, 'top-2 right-2 w-4 opacity-15')} />

          <div className={cn(s.bar, 'top-7 left-2 w-14 h-16 opacity-25')} />
          <div className={cn(s.bar, 'top-7 right-2 w-8 h-12 opacity-10')} />
        </div>
        <div className={s.card}>
          <div className={cn(s.bar, 'top-2.5 left-2.5 w-6')} />

          <div className={cn(s.bar, 'top-7 left-2 w-7 h-14 opacity-10')} />
          <div className={cn(s.bar, 'top-2 right-2 w-14 h-24 opacity-25')} />
        </div>
        <div className={cn(s.card, s.cardInactive)}>
          <div className={cn(s.bar, 'top-2 left-2 w-24 h-5 opacity-10')} />
          <div className={cn(s.bar, 'top-4 left-3 size-5 opacity-20')} />

          <div className={cn(s.bar, 'top-8 right-3 w-6 h-1 opacity-15')} />

          <div className={cn(s.bar, 'top-12 left-2 w-14 h-14 opacity-20')} />
          <div className={cn(s.bar, 'top-12 right-2 w-8 h-10 opacity-10')} />
        </div>
      </div>
      <div className={s.title}>整体布局</div>
    </div>
  )
}

export default MainLayouts
