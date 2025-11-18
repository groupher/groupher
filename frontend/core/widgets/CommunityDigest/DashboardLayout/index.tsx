import { ANCHOR } from '~/const/dom'
import useCommunityDigestViewport from '~/hooks/useCommunityDigestViewport'
import AccountUnit from '~/widgets/AccountUnit'
import ArrowLinker from '~/widgets/ArrowLinker'
import ViewportTracker from '~/widgets/ViewportTracker'
import useSalon from '../salon/dashboard_layout'
import CommunityBrief from './CommunityBrief'

export default () => {
  const s = useSalon()

  const { enterView, leaveView } = useCommunityDigestViewport()

  return (
    <div className={s.wrapper} id={ANCHOR.GLOBAL_HEADER_ID}>
      <div className={s.inner}>
        <div className={s.content}>
          <div className={s.baseInfo}>
            <CommunityBrief />
            <div className='grow' />
            <ArrowLinker>反馈</ArrowLinker>
            <ArrowLinker className='mr-4'>文档</ArrowLinker>
            <AccountUnit />
          </div>
        </div>
      </div>
      <ViewportTracker onEnter={enterView} onLeave={leaveView} />
    </div>
  )
}
