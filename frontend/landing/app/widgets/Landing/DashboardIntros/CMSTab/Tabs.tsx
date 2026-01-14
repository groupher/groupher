import CategorySVG from '~/icons/Category'
import WipSVG from '~/icons/GtdWip'
import TimeSVG from '~/icons/TimelineMode'

import useSalon, { cn } from '../../salon/dashboard_intros/cms_tab/tabs'

export default function Tabs() {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.postItemWrapper}>
        <div className={s.postItem}>讨论区</div>
      </div>
      <div className={cn(s.item, '-top-1 left-24')}>看板</div>
      <div className={cn(s.item, '-top-0.5 left-40 ml-2 z-10')}>更新日志</div>
      <div className={cn(s.item, '-top-0.5 left-56 ml-3 z-0')}>帮助台</div>
      <div className={cn(s.item, 'top-0 left-72 ml-2 -z-10')}>成员</div>

      <div className={s.bottomItem}>
        <div className={s.bottomGradient} />
        <TimeSVG className={s.icon} />
        <div className={s.title}>本周</div>
        <div className='mr-2.5' />
        <CategorySVG className={s.icon} />
        <div className={s.title}>功能请求</div>
        <div className='mr-2.5' />
        <WipSVG className={s.icon} />
        <div className={s.title}>进行中</div>
        <div className='grow' />
        <div className={s.title}>1 / 9</div>
      </div>
    </div>
  )
}
