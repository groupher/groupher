'use client'

import FloatBackground from '~/unit/DashboardThread/Layout/FloatBackground'
import GaussBlur from '~/unit/DashboardThread/Layout/GaussBlur'
import GlowLight from '~/unit/DashboardThread/Layout/GlowLight'
import useSalon from '~/unit/DashboardThread/salon/layout'

export default function Page() {
  const s = useSalon()

  return (
    <>
      <FloatBackground />
      <div className={s.divider} />
      <GaussBlur />
      <div className={s.divider} />
      <GlowLight />
    </>
  )
}
