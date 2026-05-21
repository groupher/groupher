'use client'

import { COMMUNITY_LAYOUT } from '~/const/layout'
import useLayout from '~/hooks/useLayout'
import AvatarLayout from '~/unit/DashboardThread/Appearance/AvatarLayout'
import BrandLayout from '~/unit/DashboardThread/Appearance/BrandLayout'
import CommunityLayout from '~/unit/DashboardThread/Appearance/CommunityLayout'
import FloatBackground from '~/unit/DashboardThread/Appearance/FloatBackground'
import InlineTagLayout from '~/unit/DashboardThread/Appearance/InlineTagLayout'
import NavActiveLayout from '~/unit/DashboardThread/Appearance/NavActiveLayout'
import TagLayout from '~/unit/DashboardThread/Appearance/TagLayout'
import TopbarLayout from '~/unit/DashboardThread/Appearance/TopbarLayout'
import useSalon from '~/unit/DashboardThread/Appearance/useAppearanceBaseSalon'

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
