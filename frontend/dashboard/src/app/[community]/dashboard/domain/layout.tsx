'use client'

import { DOMAIN_TABS, DSB_COVERS } from '~/const/route'
import VIEW from '~/const/view'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import useDsbTabs from '~/hooks/useDsbTabs'
import useTrans from '~/hooks/useTrans'
import type { TCrumbConfig } from '~/spec'
import Portal from '~/unit/DashboardThread/Portal'
import useSalon from '~/unit/DashboardThread/salon'
import Tabs from '~/widgets/Switcher/Tabs'

const seg = DOMAIN_TABS.segment
const CRUMB_CONFIG = {
  title: 'dsb.crumb.domain',
  seg,
  toSeg: DSB_COVERS.INTEGRATIONS,
  children: [
    { title: 'dsb.crumb.domain.platform', seg },
    { title: 'dsb.crumb.domain.custom', seg: `${seg}/custom` },
  ],
} satisfies TCrumbConfig

export default function Layout({ children }) {
  const s = useSalon()
  const { items, activeTab } = useDsbTabs(DOMAIN_TABS)
  const { t } = useTrans()

  const crumbItems = useDsbCrumbItems(CRUMB_CONFIG)

  return (
    <div className={s.content}>
      <Portal
        title={t('dsb.portal.domain.title')}
        desc={t('dsb.portal.domain.desc')}
        withDivider={false}
        crumbItems={crumbItems}
      />
      <div className={s.banner}>
        <div className={s.tabs}>
          <Tabs items={items} activeKey={activeTab} view={VIEW.DESKTOP} noAnimation />
        </div>
      </div>

      {children}
    </div>
  )
}
