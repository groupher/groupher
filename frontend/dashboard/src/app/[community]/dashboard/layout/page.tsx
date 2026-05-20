'use client'

import { COMMUNITY_LAYOUT } from '~/const/layout'
import useLayout from '~/hooks/useLayout'
import AvatarLayout from '~/unit/DashboardThread/Layout/AvatarLayout'
import BrandLayout from '~/unit/DashboardThread/Layout/BrandLayout'
import CommunityLayout from '~/unit/DashboardThread/Layout/CommunityLayout'
import FloatBackground from '~/unit/DashboardThread/Layout/FloatBackground'
import InlineTagLayout from '~/unit/DashboardThread/Layout/InlineTagLayout'
import NavActiveLayout from '~/unit/DashboardThread/Layout/NavActiveLayout'
import TagLayout from '~/unit/DashboardThread/Layout/TagLayout'
import TopbarLayout from '~/unit/DashboardThread/Layout/TopbarLayout'
import useSalon from '~/unit/DashboardThread/salon/layout'

export default function Page() {
  const s = useSalon()
  const { communityLayout } = useLayout()
  const showNavActiveLayout =
    communityLayout === COMMUNITY_LAYOUT.CLASSIC || communityLayout === COMMUNITY_LAYOUT.SIDEBAR

  return (
    <>
      <CommunityLayout />
      <div className={s.divider} />
      <BrandLayout />
      <div className={s.divider} />
      {showNavActiveLayout && (
        <>
          <NavActiveLayout />
          <div className={s.divider} />
        </>
      )}
      <AvatarLayout />
      <div className={s.divider} />
      <TagLayout />
      <div className={s.divider} />
      <InlineTagLayout />
      <div className={s.divider} />
      <FloatBackground />
      <div className={s.divider} />
      <TopbarLayout />
    </>
  )
}
