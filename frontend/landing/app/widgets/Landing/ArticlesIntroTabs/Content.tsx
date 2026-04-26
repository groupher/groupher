import type { FC } from 'react'

import { THREAD } from '~/const/thread'
import type { TThread } from '~/spec'

import useSalon from '../salon/articles_intro_tabs/content'
import ChangelogTab from './ChangelogTab'
import DiscussTab from './DiscussTab'
import HelpTab from './HelpTab'
import KanbanTab from './KanbanTab'

type TProps = {
  tab: TThread
}

const Content: FC<TProps> = ({ tab }) => {
  const s = useSalon({ tab })

  return (
    <div className={s.wrapper}>
      <div className={s.bgGradientPurple} />
      <div className={s.bgGradientBlue} />
      <div className={s.bgGradientRed} />
      <div className={s.bgGradientCyan} />

      <div className={s.inner}>
        <DiscussTab active={tab === THREAD.POST} />
        <KanbanTab active={tab === THREAD.KANBAN} />
        <ChangelogTab active={tab === THREAD.CHANGELOG} />
        <HelpTab active={tab === THREAD.DOC} />
      </div>
    </div>
  )
}

export default Content
