import type { FC } from 'react'

import type { TColorName } from '~/spec'
import useSalon, { cn } from '../../salon/dashboard_intros/layout_tab/brand_layout'

type TProps = {
  primaryColor: TColorName
}

const BrandLayout: FC<TProps> = ({ primaryColor }) => {
  const s = useSalon({ color: primaryColor })

  return (
    <div className={s.wrapper}>
      <div className={s.layouts}>
        <div className={s.card}>
          <div className={cn(s.logo, 'top-4 left-4')} />
          <div className={cn(s.bar, 'top-5 mt-0.5 left-12')} />
        </div>
        <div className={cn(s.card, s.cardInactive)}>
          <div className={cn(s.logo, 'top-4 left-8')} />
        </div>
        <div className={cn(s.card, s.cardInactive)}>
          <div className={cn(s.bar, 'top-5 mt-0.5 left-8')} />
        </div>
      </div>
      <div className={s.title}>Brand 布局</div>
    </div>
  )
}

export default BrandLayout
