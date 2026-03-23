'use client'

import FloatBackground from '~/unit/dashboard-thread/Layout/FloatBackground'
import GaussBlur from '~/unit/dashboard-thread/Layout/GaussBlur'
import GlowLight from '~/unit/dashboard-thread/Layout/GlowLight'
import PageBackground from '~/unit/dashboard-thread/Layout/PageBackground'
import PrimaryColor from '~/unit/dashboard-thread/Layout/PrimaryColor'
import Wallpaper from '~/unit/dashboard-thread/Layout/Wallpaper'

import useSalon from '~/unit/dashboard-thread/salon/layout'

export default function Page() {
  const s = useSalon()

  return (
    <>
      <PrimaryColor />
      <div className={s.divider} />
      <FloatBackground />
      <div className={s.divider} />
      <PageBackground />
      <div className={s.divider} />
      <Wallpaper />
      <div className={s.divider} />
      <GaussBlur />
      <div className={s.divider} />
      <GlowLight />
    </>
  )
}
