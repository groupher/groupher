'use client'

import CommunityDigest from '~/widgets/CommunityDigest'

import useSalon from './salon'

import SideMenu from '~/containers/thread/DashboardThread/SideMenu'

const Layout = ({ children }) => {
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

export default Layout
