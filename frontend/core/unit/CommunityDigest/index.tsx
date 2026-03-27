/*
 *
 * CommunityDigest
 *
 */

import { Fragment } from 'react'

import { BANNER_LAYOUT } from '~/const/layout'
// import { ROUTE } from '~/const/route'
import useLayout from '~/hooks/useLayout'

import HeaderLayout from './HeaderLayout'
import SidebarLayout from './SidebarLayout'
import TabberLayout from './TabberLayout'

export default function CommunityDigest() {
  // const router = useRouter()
  const { bannerLayout } = useLayout()

  return (
    <Fragment>
      {bannerLayout === BANNER_LAYOUT.TABBER && <TabberLayout />}
      {bannerLayout === BANNER_LAYOUT.SIDEBAR && <SidebarLayout />}
      {bannerLayout === BANNER_LAYOUT.HEADER && <HeaderLayout />}
    </Fragment>
  )
}
