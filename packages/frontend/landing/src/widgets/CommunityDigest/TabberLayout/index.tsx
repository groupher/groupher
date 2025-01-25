import { useRouter } from 'next/navigation'

import usePublicThreads from '~/hooks/usePublicThreads'
import useViewingThread from '~/hooks/useViewingThread'
import useCommunityDigestViewport from '~/hooks/useCommunityDigestViewport'
import useViewingCommunity from '~/hooks/useViewingCommunity'
import useHeaderLinks from '~/hooks/useHeaderLinks'

import TabBar from '~/widgets/TabBar'
import CustomHeaderLinks from '~/widgets/CustomHeaderLinks'
import ViewportTracker from '~/widgets/ViewportTracker'

import CommunityBrief from './CommunityBrief'

import useSalon from '../salon/tabber_layout'

// 没有各种外链接，打赏信息等的官方社区
// const NON_STANDARD_COMMUNITIES = [HCN, 'feedback']

export default () => {
  const s = useSalon()

  const router = useRouter()
  const { enterView, leaveView } = useCommunityDigestViewport()
  const publicThreads = usePublicThreads()
  const activeThread = useViewingThread()
  const community = useViewingCommunity()
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
