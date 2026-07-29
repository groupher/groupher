'use client'

import type { ReactNode } from 'react'

import { DSB_COVERS, DSB_ROUTE } from '~/const/route'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import useTrans from '~/hooks/useTrans'
import type { TCrumbConfig } from '~/spec'
import Portal from '~/unit/DashboardThread/Portal'
import useSalon, { cnMerge } from '~/unit/DashboardThread/salon'

const seg = DSB_ROUTE.ASSETS
const CRUMB_CONFIG = {
  title: 'dsb.crumb.cms',
  seg,
  toSeg: DSB_COVERS.CMS,
  children: [{ title: 'dsb.menu.assets', seg }],
} satisfies TCrumbConfig

export default function Layout({ children }: { children: ReactNode }) {
  const s = useSalon()
  const { t } = useTrans()
  const crumbItems = useDsbCrumbItems(CRUMB_CONFIG)

  return (
    <div className={cnMerge(s.content, 'w-full pl-24 pr-10')}>
      <Portal
        title={t('dsb.menu.assets')}
        desc={t('dsb.covers.item.assets.desc')}
        crumbItems={crumbItems}
        withDivider={false}
      />

      {children}
    </div>
  )
}
