'use client'

import type { ReactNode } from 'react'

import { DSB_ROUTE } from '~/const/route'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import useTrans from '~/hooks/useTrans'
import type { TCrumbConfig } from '~/spec'
import Portal from '~/unit/DashboardThread/Portal'
import useSalon, { cnMerge } from '~/unit/DashboardThread/salon'

const CRUMB_CONFIG = {
  title: 'dsb.crumb.analytics',
  seg: DSB_ROUTE.LOG,
  toSeg: DSB_ROUTE.ANALYSIS,
  children: [{ title: 'dsb.crumb.analytics.log', seg: DSB_ROUTE.LOG }],
} satisfies TCrumbConfig

export default function LogLayout({ children }: { children: ReactNode }) {
  const s = useSalon()
  const { t } = useTrans()
  const crumbItems = useDsbCrumbItems(CRUMB_CONFIG)

  return (
    <div className={cnMerge(s.content, 'w-full max-w-none pl-24 pr-0')}>
      <Portal
        title={t('dsb.menu.log')}
        desc={t('dsb.covers.item.log.desc')}
        crumbItems={crumbItems}
        withDivider
      />
      {children}
    </div>
  )
}
