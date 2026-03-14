'use client'

import { DSB_COVERS, THIRD_PART_TABS } from '~/const/route'
import VIEW from '~/const/view'
import Portal from '~/containers/thread/DashboardThread/Portal'
import useSalon from '~/containers/thread/DashboardThread/salon'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import useDsbLayoutTabs from '~/hooks/useDsbLayoutTabs'
import useTrans from '~/hooks/useTrans'
import type { TCrumbConfig } from '~/spec'
import Tabs from '~/widgets/Switcher/Tabs'

const seg = THIRD_PART_TABS.segment
const CRUMB_CONFIG = {
  title: 'dsb.crumb.integrations',
  seg,
  toSeg: DSB_COVERS.INTEGRATIONS,
  children: [
    { title: 'dsb.crumb.analytics', seg },
    { title: 'dsb.crumb.webhooks', seg: `${seg}/webhooks` },
    { title: 'dsb.crumb.bots', seg: `${seg}/bots` },
    { title: 'dsb.crumb.email', seg: `${seg}/email` },
    { title: 'dsb.crumb.content_sync', seg: `${seg}/content-sync` },
  ],
} satisfies TCrumbConfig

export default function Layout({ children }) {
  const s = useSalon()
  const { items, activeTab } = useDsbLayoutTabs(THIRD_PART_TABS)
  const { t } = useTrans()
  const crumbItems = useDsbCrumbItems(CRUMB_CONFIG)

  return (
    <div className={s.content}>
      <Portal
        title={t('dsb.portal.third_part.title')}
        desc={t('dsb.portal.third_part.desc')}
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
