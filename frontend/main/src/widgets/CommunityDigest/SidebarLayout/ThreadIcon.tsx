import type { FC } from 'react'

import type { TActive, TThread } from '~/spec'
import { THREAD } from '~/const/thread'

import KanbanSVG from '~/icons/Kanban'
import DiscussSVG from '~/icons/Discuss'
import TadaSVG from '~/icons/TadaRaw'
import InfoSVG from '~/icons/Info'
import GuideSVG from '~/icons/Book'

import useSalon, { cn } from '../salon/sidebar_layout/thread_icon'

type TProps = {
  thread: TThread
} & TActive

const ThreadIcon: FC<TProps> = ({ thread, active }) => {
  const s = useSalon()

  switch (thread) {
    case THREAD.POST: {
      return (
        <div className={s.wrapper}>
          <DiscussSVG className={cn(s.icon, active && s.iconActive)} />
        </div>
      )
    }
    case THREAD.CHANGELOG: {
      return (
        <div className={s.wrapper}>
          <TadaSVG className={cn(s.icon, active && s.iconActive)} />
        </div>
      )
    }
    case THREAD.KANBAN: {
      return (
        <div className={s.wrapper}>
          <KanbanSVG className={cn(s.icon, 'size-4 rotate-180', active && s.iconActive)} />
        </div>
      )
    }
    case THREAD.DOC: {
      return (
        <div className={s.wrapper}>
          <GuideSVG className={cn(s.icon, 'size-3.5', active && s.iconActive)} />
        </div>
      )
    }

    case THREAD.ABOUT: {
      return (
        <div className={s.wrapper}>
          <InfoSVG className={cn(s.icon, active && s.iconActive)} />
        </div>
      )
    }

    default: {
      return (
        <div className={s.wrapper}>
          <InfoSVG className={cn(s.icon, active && s.iconActive)} />
        </div>
      )
    }
  }
}

export default ThreadIcon
