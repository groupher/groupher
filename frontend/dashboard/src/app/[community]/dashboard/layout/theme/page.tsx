'use client'

import GaussBlur from '~/containers/thread/DashboardThread/Layout/GaussBlur'
import GlowLight from '~/containers/thread/DashboardThread/Layout/GlowLight'
import PageBackground from '~/containers/thread/DashboardThread/Layout/PageBackground'
import PrimaryColor from '~/containers/thread/DashboardThread/Layout/PrimaryColor'
import Wallpaper from '~/containers/thread/DashboardThread/Layout/Wallpaper'

import useSalon from '~/containers/thread/DashboardThread/salon/layout'

export default () => {
  const s = useSalon()

  return (
    <>
      <PrimaryColor />
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
