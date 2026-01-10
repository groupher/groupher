'use client'

import SideMenu from '~/containers/thread/DashboardThread/SideMenu'
import CommunityDigest from '~/widgets/CommunityDigest'
import useSalon from './salon'

const ClientLayout = ({ children }) => {
  const s = useSalon()

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

export default ClientLayout
