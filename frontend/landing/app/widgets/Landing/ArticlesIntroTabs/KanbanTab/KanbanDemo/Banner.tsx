import GtdDoneSVG from '~/icons/GtdDone'
import GtdTodoSVG from '~/icons/GtdTodo'

import GtdWipSVG from '~/icons/GtdWip'
import useTrans from '~/hooks/useTrans'
import { mockUsers } from '~/mock'
import Facepile from '~/widgets/Facepile/LandingPage'

import useSalon, { cn } from '../../../salon/articles_intro_tabs/kanban_tab/banner'

export default function Banner() {
  const s = useSalon()
  const { t } = useTrans()

  const users = mockUsers(5)

  return (
    <div className={s.wrapper}>
      <div className={s.inner}>
        <div className={s.header}>
          <div className={cn(s.title, s.titleActrive)}>
            {t('landing.articles.kanban.banner.current')}
          </div>
          <div className={cn(s.title, 'ml-1.5 mr-0.5 opacity-50')}>/</div>
          <div className={s.title}>{t('landing.articles.kanban.banner.future')}</div>
          <div className='grow' />
          <Facepile users={users} className='-mr-2 scale-75 gap-x-1 opacity-65' />
        </div>
        <div className={s.labelBar}>
          <div className={cn(s.item, 'left-1 bottom-0')}>
            <GtdWipSVG className={s.icon} />
            <div className={s.label}>{t('landing.articles.kanban.banner.todo')}</div>
          </div>

          <div className={cn(s.item, 'left-60 bottom-0')}>
            <GtdDoneSVG className={s.icon} />
            <div className={s.label}>{t('landing.articles.kanban.banner.wip')}</div>
          </div>

          <div className={cn(s.item, 'right-36 bottom-0')}>
            <GtdTodoSVG className={s.icon} />
            <div className={s.label}>{t('landing.articles.kanban.banner.done')}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
