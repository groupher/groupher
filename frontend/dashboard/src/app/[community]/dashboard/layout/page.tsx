'use client'

import AvatarLayout from '~/containers/thread/DashboardThread/Layout/AvatarLayout'
import BannerLayout from '~/containers/thread/DashboardThread/Layout/BannerLayout'
import BrandLayout from '~/containers/thread/DashboardThread/Layout/BrandLayout'
import InlineTagLayout from '~/containers/thread/DashboardThread/Layout/InlineTagLayout'
import TagLayout from '~/containers/thread/DashboardThread/Layout/TagLayout'
import TopbarLayout from '~/containers/thread/DashboardThread/Layout/TopbarLayout'

import useSalon from '~/containers/thread/DashboardThread/salon/layout'

export default function Page() {
  const s = useSalon()

  return (
    <>
      <BrandLayout />
      <div className={s.divider} />
      <BannerLayout />
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
