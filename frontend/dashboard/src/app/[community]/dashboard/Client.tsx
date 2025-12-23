'use client'

import { DSB_ROUTE } from '~/const/route'
import SideMenu from '~/containers/thread/DashboardThread/SideMenu'
import useDSBRouteTabSync, { isRouteOf } from '~/hooks/useDSBRouteTabSync'
import CommunityDigest from '~/widgets/CommunityDigest'
import useSalon from './salon'

const Layout = ({ children }) => {
  const s = useSalon()

  useDSBRouteTabSync({
    tab: 'curTab',
    defaultTab: DSB_ROUTE.OVERVIEW,
    segmentIndex: 2,
    validator: isRouteOf(DSB_ROUTE),
  })

  return (
    <div className={s.wrapper}>
      <CommunityDigest />

      <div className={s.inner}>
        <div className={s.content}>
          <SideMenu />
          <div className={s.main}>{children}</div>
        </div>
      </div>
    </div>
  )
}

export default Layout
