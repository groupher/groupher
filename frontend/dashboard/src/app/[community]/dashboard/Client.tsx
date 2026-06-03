'use client'

import CommunityDigest from '~/unit/CommunityDigest/dashboard-layout'
import { SideMenu } from '~/unit/DashboardThread'

import useSalon from './salon'

const ClientLayout = ({ children, demoMode = false }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper} data-demo-mode={demoMode ? 'true' : 'false'}>
      <div className={s.layoutFrame}>
        <CommunityDigest />

        <div className={s.inner}>
          <div className={s.sideMenuClip}>
            <SideMenu />
          </div>
          <div className={s.children}>{children}</div>
        </div>
      </div>
    </div>
  )
}

export default ClientLayout
