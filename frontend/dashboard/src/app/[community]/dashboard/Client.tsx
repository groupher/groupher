'use client'

import { SideMenu } from '~/unit/dashboard-thread'
import CommunityDigest from '~/unit/community-digest/dashboard-layout'
import useSalon from './salon'

const ClientLayout = ({ children, demoMode = false }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper} data-demo-mode={demoMode ? 'true' : 'false'}>
      <CommunityDigest />

      <div className={s.inner}>
        <SideMenu />
        <div className={s.children}>{children}</div>
      </div>
    </div>
  )
}

export default ClientLayout
