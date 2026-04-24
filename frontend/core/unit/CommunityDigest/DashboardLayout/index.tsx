import { ANCHOR } from '~/const/dom'
import { DOCS, FEEDBACK } from '~/const/route'
import useCommunityDigestViewport from '~/hooks/useCommunityDigestViewport'
import AccountUnit from '~/widgets/AccountUnit'
import ArrowLinker from '~/widgets/ArrowLinker'
import ViewportTracker from '~/widgets/ViewportTracker'
import useSalon from '../salon/dashboard_layout'
import CommunityBrief from './CommunityBrief'

export default function DashboardLayout() {
  const s = useSalon()

  const { enterView, leaveView } = useCommunityDigestViewport()

  return (
    <div className={s.wrapper} id={ANCHOR.GLOBAL_CLASSIC_ID}>
      <div className={s.inner}>
        <div className={s.content}>
          <div className={s.baseInfo}>
            <CommunityBrief />
            <div className='grow' />
            <ArrowLinker href={FEEDBACK} noColor>
              反馈
            </ArrowLinker>
            <ArrowLinker href={DOCS} className='mr-4' noColor>
              文档
            </ArrowLinker>
            <AccountUnit />
          </div>
        </div>
      </div>
      <ViewportTracker onEnter={enterView} onLeave={leaveView} />
    </div>
  )
}
