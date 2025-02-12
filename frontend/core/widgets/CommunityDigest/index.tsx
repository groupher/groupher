/*
 *
 * CommunityDigest
 *
 */
import { Fragment } from 'react'
import { usePathname } from 'next/navigation'

import { BANNER_LAYOUT } from '~/const/layout'
// import { ROUTE } from '~/const/route'
import useLayout from '~/hooks/useLayout'

import DashboardLayout from './DashboardLayout'
import SidebarLayout from './SidebarLayout'
import TabberLayout from './TabberLayout'
import HeaderLayout from './HeaderLayout'

export default () => {
  // const router = useRouter()
  const { bannerLayout } = useLayout()
  const pathname = usePathname()

  if (pathname.split('/')[2] === 'dashboard') {
    return <DashboardLayout />
  }

  return (
    <Fragment>
      {bannerLayout === BANNER_LAYOUT.TABBER && <TabberLayout />}
      {bannerLayout === BANNER_LAYOUT.SIDEBAR && <SidebarLayout />}
      {bannerLayout === BANNER_LAYOUT.HEADER && <HeaderLayout />}
    </Fragment>
  )
}
