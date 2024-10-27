import { mockUsers } from '~/mock'

import Facepile from '~/widgets/Facepile/LandingPage'

import GtdWipSVG from '~/icons/GtdWip'
import GtdDoneSVG from '~/icons/GtdDone'
import GtdTodoSVG from '~/icons/GtdTodo'

import useSalon, { cn } from '../../../salon/articles_intro_tabs/kanban_tab/banner'

export default () => {
  const s = useSalon()

  const users = mockUsers(5)

  return (
    <div className={s.wrapper}>
      <div className={s.inner}>
        <div className={s.header}>
          <div className={cn(s.title, s.titleActrive)}>当前</div>
          <div className={cn(s.title, 'ml-1.5 mr-0.5 opacity-50')}>/</div>
          <div className={s.title}>中长期规划</div>
          <div className="grow" />
          <Facepile users={users} className="-mr-2 scale-75 gap-x-1 opacity-65" />
        </div>
        <div className={s.labelBar}>
          <div className={cn(s.item, 'left-1 bottom-0')}>
            <GtdWipSVG className={s.icon} />
            <label className={s.label}>已计划</label>
          </div>

          <div className={cn(s.item, 'left-60 bottom-0')}>
            <GtdDoneSVG className={s.icon} />
            <label className={s.label}>进行中</label>
          </div>

          <div className={cn(s.item, 'right-36 bottom-0')}>
            <GtdTodoSVG className={s.icon} />
            <label className={s.label}>已完成</label>
          </div>
        </div>
      </div>
    </div>
  )
}
