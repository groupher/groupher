import { ANCHOR } from '~/const/dom'
import useCommunityDigestViewport from '~/hooks/useCommunityDigestViewport'

import ViewportTracker from '~/widgets/ViewportTracker'
import AccountUnit from '~/widgets/AccountUnit'

import CommunityBrief from './CommunityBrief'

import useSalon from '../salon/dashboard_layout'

export default () => {
  const s = useSalon()

  const { enterView, leaveView } = useCommunityDigestViewport()

  return (
    <div className={s.wrapper} id={ANCHOR.GLOBAL_HEADER_ID}>
      <div className={s.inner}>
        <div className={s.content}>
          <div className={s.baseInfo}>
            <CommunityBrief />
            <div className="grow" />
            <AccountUnit />
          </div>
        </div>
      </div>
      <ViewportTracker onEnter={enterView} onLeave={leaveView} />
    </div>
  )
}
