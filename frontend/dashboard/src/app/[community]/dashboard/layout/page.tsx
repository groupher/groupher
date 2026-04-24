'use client'

import AvatarLayout from '~/unit/DashboardThread/Layout/AvatarLayout'
import CommunityLayout from '~/unit/DashboardThread/Layout/CommunityLayout'
import BrandLayout from '~/unit/DashboardThread/Layout/BrandLayout'
import InlineTagLayout from '~/unit/DashboardThread/Layout/InlineTagLayout'
import TagLayout from '~/unit/DashboardThread/Layout/TagLayout'
import TopbarLayout from '~/unit/DashboardThread/Layout/TopbarLayout'

import useSalon from '~/unit/DashboardThread/salon/layout'

export default function Page() {
  const s = useSalon()

  return (
    <>
      <CommunityLayout />
      <div className={s.divider} />
      <BrandLayout />
      <div className={s.divider} />
      <AvatarLayout />
      <div className={s.divider} />
      <TagLayout />
      <div className={s.divider} />
      <InlineTagLayout />
      <div className={s.divider} />
      <TopbarLayout />
    </>
  )
}
