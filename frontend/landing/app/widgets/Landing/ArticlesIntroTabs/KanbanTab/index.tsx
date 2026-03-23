import type { FC } from 'react'

import type { TActive } from '~/spec'
import useSalon, { cn } from '../../salon/articles_intro_tabs/kanban_tab'
import IntroDigest from './IntroDigest'
import KanbanDemo from './KanbanDemo'

const KanbanFeat: FC<TActive> = ({ active }) => {
  const s = useSalon()

  return (
    <div className={cn(s.wrapper, active && s.active)}>
      <IntroDigest />
      <KanbanDemo />
    </div>
  )
}

export default KanbanFeat
