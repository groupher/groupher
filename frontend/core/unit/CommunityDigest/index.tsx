/*
 *
 * CommunityDigest
 *
 */

import { Fragment } from 'react'

import { COMMUNITY_LAYOUT } from '~/const/layout'
// import { ROUTE } from '~/const/route'
import useLayout from '~/hooks/useLayout'

import ClassicLayout from './ClassicLayout'
import HeroLayout from './HeroLayout'
import SidebarLayout from './SidebarLayout'

export default function CommunityDigest() {
  // const router = useRouter()
  const { communityLayout } = useLayout()

  return (
    <Fragment>
      {communityLayout === COMMUNITY_LAYOUT.HERO && <HeroLayout />}
      {communityLayout === COMMUNITY_LAYOUT.SIDEBAR && <SidebarLayout />}
      {communityLayout === COMMUNITY_LAYOUT.CLASSIC && <ClassicLayout />}
    </Fragment>
  )
}
