/*
 *
 * CommunityDigest
 *
 */

import { Fragment, lazy, Suspense } from 'react'

import { BANNER_LAYOUT } from '~/const/layout'
// import { ROUTE } from '~/const/route'
import useLayout from '~/hooks/useLayout'

import HeaderLayout from './HeaderLayout'
import TabberLayout from './TabberLayout'

const SidebarLayout = lazy(() => import('./SidebarLayout'))

export default function CommunityDigest() {
  // const router = useRouter()
  const { bannerLayout } = useLayout()

  return (
    <Fragment>
      {bannerLayout === BANNER_LAYOUT.TABBER && <TabberLayout />}
      {bannerLayout === BANNER_LAYOUT.SIDEBAR && (
        <Suspense fallback={null}>
          <SidebarLayout />
        </Suspense>
      )}
      {bannerLayout === BANNER_LAYOUT.HEADER && <HeaderLayout />}
    </Fragment>
  )
}
