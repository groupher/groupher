'use client'

import type { ReactNode } from 'react'

import { DSB_ROUTE } from '~/const/route'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import useTrans from '~/hooks/useTrans'
import type { TCrumbConfig } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import RealtimeOnline from '~/unit/DsbThread/Analysis/RealtimeOnline'
import Portal from '~/unit/DsbThread/Portal'
import useSalon, { cnMerge } from '~/unit/DsbThread/salon'

const CRUMB_CONFIG = {
  title: 'dsb.crumb.analytics',
  seg: DSB_ROUTE.TREND,
  toSeg: DSB_ROUTE.ANALYSIS,
  children: [{ title: 'dsb.crumb.analytics.trend', seg: DSB_ROUTE.TREND }],
} satisfies TCrumbConfig

export default function TrendLayout({ children }: { children: ReactNode }) {
  const s = useSalon()
  const { t } = useTrans()
  const { slug: community } = useCommunity()
  const crumbItems = useDsbCrumbItems(CRUMB_CONFIG)

  return (
    <div className={cnMerge(s.content, 'w-full max-w-none pl-24 pr-0')}>
      <Portal
        title={t('dsb.menu.trend')}
        desc={t('dsb.analysis.desc')}
        addonAlign='edges'
        addon={community ? <RealtimeOnline community={community} /> : null}
        crumbItems={crumbItems}
        withDivider
      />
      {children}
    </div>
  )
}
