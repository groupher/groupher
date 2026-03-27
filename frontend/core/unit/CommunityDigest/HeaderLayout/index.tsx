import { ANCHOR } from '~/const/dom'
import { HEADER_LAYOUT } from '~/const/layout'
import useCommunityDigestViewport from '~/hooks/useCommunityDigestViewport'
import useHeaderLinks from '~/hooks/useHeaderLinks'
import AccountUnit from '~/widgets/AccountUnit'
import ViewportTracker from '~/widgets/ViewportTracker'
import useSalon, { cn } from '../salon/header_layout'
import CommunityBrief from './CommunityBrief'
import ThreadTab from './ThreadTab'

export default function HeaderLayout() {
  const s = useSalon()

  const { layout } = useHeaderLinks()
  const { enterView, leaveView } = useCommunityDigestViewport()

  return (
    <>
      <div id={ANCHOR.GLOBAL_HEADER_ID} className={cn(s.wrapper, 'header-layout-community-brief')}>
        <CommunityBrief />
        {layout === HEADER_LAYOUT.RIGHT && <div className='grow' />}
        <ThreadTab right={layout === HEADER_LAYOUT.RIGHT ? 20 : 0} />
        {/* <GithubItem href="/">
                <img
                  alt="GitHub Repo stars"
                  src="https://img.shields.io/github/stars/vercel/next.js?style=social&logo=github&label=%20%20&labelColor=black&color=white"
                />
              </GithubItem> */}
        <AccountUnit />
      </div>
      <ViewportTracker onEnter={enterView} onLeave={leaveView} rootMargin='-20px' />
    </>
  )
}
