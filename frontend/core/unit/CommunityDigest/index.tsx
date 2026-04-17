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
  const { globalLayout } = useLayout()

  return (
    <Fragment>
      {globalLayout === BANNER_LAYOUT.TABBER && <TabberLayout />}
      {globalLayout === BANNER_LAYOUT.SIDEBAR && <SidebarLayout />}
      {globalLayout === BANNER_LAYOUT.HEADER && <HeaderLayout />}
    </Fragment>
  )
}
