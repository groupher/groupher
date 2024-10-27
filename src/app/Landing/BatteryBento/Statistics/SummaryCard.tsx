import type { FC } from 'react'

import UpSVG from '~/icons/Goup'
import DownSVG from '~/icons/Godown'

import useSalon, { cn } from '../../salon/battery_bento/statistics/summary_card'

type TProps = {
  hovering: boolean
}

const SummaryCard: FC<TProps> = ({ hovering }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <section className={s.block}>
        <h3 className={s.title}>访客数</h3>
        <div className={s.num}>
          938
          {hovering && <UpSVG className={cn(s.icon, s.iconGreen, 'animation-fade-up')} />}
        </div>
      </section>

      <section className={s.block}>
        <h3 className={s.title}>访问次数</h3>
        <div className={s.num}>
          827
          {hovering && <UpSVG className={cn(s.icon, s.iconGreen, 'animation-fade-up')} />}
        </div>
      </section>
      <section className={s.block}>
        <h3 className={s.title}>访问时长</h3>
        <div className={cn(s.num, 'opacity-80')}>
          5:32
          {hovering && <UpSVG className={cn(s.icon, s.iconGreen, 'animation-fade-up')} />}
        </div>
      </section>
      <section className={s.block}>
        <h3 className={s.title}>跳出率</h3>
        <div className={cn(s.num, 'opacity-80')}>
          5.1%
          {hovering && <DownSVG className={cn(s.icon, s.iconRed, 'animation-fade-down')} />}
        </div>
      </section>
    </div>
  )
}

export default SummaryCard
