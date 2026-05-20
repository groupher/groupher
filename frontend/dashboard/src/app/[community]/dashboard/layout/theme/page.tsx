'use client'

import GaussBlur from '~/unit/DashboardThread/Layout/GaussBlur'
import GlowLight from '~/unit/DashboardThread/Layout/GlowLight'
import useSalon from '~/unit/DashboardThread/salon/layout'

export default function Page() {
  const s = useSalon()

  return (
    <>
      <GaussBlur />
      <div className={s.divider} />
      <GlowLight />
    </>
  )
}
