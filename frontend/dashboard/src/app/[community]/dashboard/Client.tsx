'use client'

import { DSB_ROUTE, DSB_TAB } from '~/const/route'
import SideMenu from '~/containers/thread/DashboardThread/SideMenu'
import useSyncDSBRoute2Tab, { isRouteOf } from '~/hooks/useSyncDSBRoute2Tab'
import CommunityDigest from '~/widgets/CommunityDigest'
import useSalon from './salon'

const Layout = ({ children }) => {
  const s = useSalon()

  useSyncDSBRoute2Tab({
    tab: DSB_TAB.MENU,
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
