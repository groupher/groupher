'use client'

import { DSB_ROUTE } from '~/const/route'
import SideMenu from '~/containers/thread/DashboardThread/SideMenu'
import useDSBRouteTabSync from '~/hooks/useDSBRouteTabSync'
import type { TDsbPath } from '~/spec'
import CommunityDigest from '~/widgets/CommunityDigest'
import useSalon from './salon'

const pathValidator = (value: string): value is TDsbPath => {
  return Object.values(DSB_ROUTE).includes(value as TDsbPath)
}

const Layout = ({ children }) => {
  const s = useSalon()

  useDSBRouteTabSync({
    tab: 'curTab',
    defaultTab: DSB_ROUTE.OVERVIEW,
    segmentIndex: 2,
    pathValidator,
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
