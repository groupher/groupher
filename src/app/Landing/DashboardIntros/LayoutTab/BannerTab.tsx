import type { FC } from 'react'

import type { TColorName } from '~/spec'

import useSalon, { cn } from '../../salon/dashboard_intros/layout_tab/banner_tab'

type TProps = {
  primaryColor: TColorName
}

const BannerTab: FC<TProps> = ({ primaryColor }) => {
  const s = useSalon({ color: primaryColor })

  return (
    <div className={s.wrapper}>
      <div className={s.itemsWrapper}>
        <div className={cn(s.item, s.itemActive)}>通用</div>
        <div className={s.item}>主题/背景</div>
        <div className={s.item}>讨论区</div>
        <div className={s.item}>看板</div>
        <div className={s.item}>更新日志</div>
        <div className={s.item}>..</div>
      </div>
      <div className={s.divider} />
    </div>
  )
}

export default BannerTab
