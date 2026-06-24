'use client'

import type { ReactNode } from 'react'

import { DOC_LAYOUT_TABS, DSB_COVERS, DSB_DOC_ROUTE, DSB_ROUTE } from '~/const/route'
import VIEW from '~/const/view'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import useDsbTabs from '~/hooks/useDsbTabs'
import useTrans from '~/hooks/useTrans'
import type { TCrumbConfig } from '~/spec'
import Portal from '~/unit/DashboardThread/Portal'
import useSalon from '~/unit/DashboardThread/salon'
import Tabs from '~/widgets/Switcher/Tabs'

const seg = DSB_ROUTE.DOC
const CRUMB_CONFIG = {
  title: 'dsb.crumb.cms',
  seg,
  toSeg: DSB_COVERS.CMS,
  children: [{ title: 'dsb.crumb.doc.layout', seg: `${seg}/${DSB_DOC_ROUTE.LAYOUT}` }],
} satisfies TCrumbConfig

export default function DashboardDocLayoutTabs({ children }: { children: ReactNode }) {
  const s = useSalon()
  const { items, activeTab } = useDsbTabs(DOC_LAYOUT_TABS)
  const { t } = useTrans()
  const crumbItems = useDsbCrumbItems(CRUMB_CONFIG)

  return (
    <>
      <Portal
        title={t('dsb.doc.layout')}
        desc={t('dsb.appearance.doc.desc')}
        crumbItems={crumbItems}
        withDivider={false}
      />
      <div className={s.banner}>
        <div className={s.tabs}>
          <Tabs items={items} activeKey={activeTab} view={VIEW.DESKTOP} noAnimation />
        </div>
      </div>

      {children}
    </>
  )
}
