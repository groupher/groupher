'use client'

import FloatBackground from '~/unit/DashboardThread/Layout/FloatBackground'
import GaussBlur from '~/unit/DashboardThread/Layout/GaussBlur'
import GlowLight from '~/unit/DashboardThread/Layout/GlowLight'
import PageBackground from '~/unit/DashboardThread/Layout/PageBackground'
import PrimaryColor from '~/unit/DashboardThread/Layout/PrimaryColor'
import useSalon from '~/unit/DashboardThread/salon/layout'

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
      <GaussBlur />
      <div className={s.divider} />
      <GlowLight />
    </>
  )
}
