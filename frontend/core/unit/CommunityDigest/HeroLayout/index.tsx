import { useRouter } from 'next/navigation'

import useCommunityDigestViewport from '~/hooks/useCommunityDigestViewport'
import useHeaderLinks from '~/hooks/useHeaderLinks'
import usePublicThreads from '~/hooks/usePublicThreads'
import useViewingThread from '~/hooks/useViewingThread'
import useCommunity from '~/stores/community/hooks'
import CustomHeaderLinks from '~/unit/HeaderLinks'
import TabBar from '~/widgets/TabBar'
import ViewportTracker from '~/widgets/ViewportTracker'

import useSalon from '../salon/hero_layout'
import CommunityBrief from './CommunityBrief'

export default function HeroLayout() {
  const s = useSalon()

  const router = useRouter()
  const { enterView, leaveView } = useCommunityDigestViewport()
  const publicThreads = usePublicThreads()
  const activeThread = useViewingThread()
  const community = useCommunity()
  const { getCustomLinks } = useHeaderLinks()

  const customLinks = getCustomLinks()

  return (
    <div className={s.wrapper}>
      <div className={s.inner}>
        <CommunityBrief />
        <div className={s.tabs}>
          <TabBar
            source={publicThreads}
            onChange={(path) => router.push(`/${community.slug}/${path}`)}
            active={activeThread}
            withIcon
          />
          <CustomHeaderLinks links={customLinks} />
        </div>
        <ViewportTracker onEnter={enterView} onLeave={leaveView} />
      </div>
    </div>
  )
}
