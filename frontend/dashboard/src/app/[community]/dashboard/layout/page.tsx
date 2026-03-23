'use client'

import AvatarLayout from '~/unit/dashboard-thread/Layout/AvatarLayout'
import BannerLayout from '~/unit/dashboard-thread/Layout/BannerLayout'
import BrandLayout from '~/unit/dashboard-thread/Layout/BrandLayout'
import InlineTagLayout from '~/unit/dashboard-thread/Layout/InlineTagLayout'
import TagLayout from '~/unit/dashboard-thread/Layout/TagLayout'
import TopbarLayout from '~/unit/dashboard-thread/Layout/TopbarLayout'

import useSalon from '~/unit/dashboard-thread/salon/layout'

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
