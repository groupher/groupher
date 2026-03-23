import type { FC } from 'react'

import { THREAD } from '~/const/thread'
import ArrowSVG from '~/icons/ArrowUpRight'
import GuideSVG from '~/icons/Book'
import DiscussSVG from '~/icons/Discuss'
import InfoSVG from '~/icons/Info'
import KanbanSVG from '~/icons/Kanban'
import TadaSVG from '~/icons/TadaRaw'

import useSalon, { cn } from '../salon/tabs/local_icon'

type TProps = {
  slug: string
  active: boolean
  small?: boolean
}

const TabIcon: FC<TProps> = ({ slug, active, small }) => {
  const s = useSalon({ small })

  const className = cn(s.icon, active && s.active)

  switch (slug) {
    case THREAD.POST: {
      return <DiscussSVG className={className} />
    }

    case THREAD.KANBAN: {
      return <KanbanSVG className={cn(className, 'rotate-180')} />
    }

    case THREAD.DOC: {
      return <GuideSVG className={className} />
    }

    case THREAD.CHANGELOG: {
      return <TadaSVG className={className} />
    }

    case THREAD.ABOUT: {
      return <InfoSVG className={className} />
    }

    default: {
      return <ArrowSVG className={className} />
    }
  }
}

export default TabIcon
