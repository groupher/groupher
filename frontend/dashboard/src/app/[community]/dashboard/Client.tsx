'use client'

import SideMenu from '~/containers/thread/DashboardThread/SideMenu'
import CommunityDigest from '~/widgets/CommunityDigest/DashboardLayout'
import useSalon from './salon'

const ClientLayout = ({ children }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <CommunityDigest />

      <div className={s.inner}>
        <SideMenu />
        <div className={s.children}>{children}</div>
      </div>
    </div>
  )
}

export default ClientLayout
