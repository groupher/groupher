import type { FC } from 'react'

import { COMMUNITY_LAYOUT } from '~/const/layout'
import { THREAD } from '~/const/thread'
import useLayout from '~/hooks/useLayout'
import useViewingThread from '~/hooks/useViewingThread'

import ClassicLayout from './ClassicLayout'
import HeroLayout from './HeroLayout'
import SidebarLayout from './SidebarLayout'
import type { TProps } from './spec'

const CustomHeaderLinks: FC<TProps> = (props) => {
  const { communityLayout } = useLayout()
  const activeThread = useViewingThread()

  if (activeThread === THREAD.DASHBOARD) {
    return <ClassicLayout {...props} />
  }

  switch (communityLayout) {
    case COMMUNITY_LAYOUT.CLASSIC: {
      return <ClassicLayout {...props} />
    }

    case COMMUNITY_LAYOUT.SIDEBAR: {
      return <SidebarLayout {...props} />
    }

    default: {
      return <HeroLayout {...props} />
    }
  }
}

export default CustomHeaderLinks
