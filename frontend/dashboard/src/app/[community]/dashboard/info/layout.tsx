'use client'

import { DSB_COVERS, INFO_TABS } from '~/const/route'
import VIEW from '~/const/view'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import useDsbLayoutTabs from '~/hooks/useDsbLayoutTabs'
import useTrans from '~/hooks/useTrans'
import type { TCrumbConfig } from '~/spec'
import Portal from '~/unit/dashboard-thread/Portal'
import useSalon, { cnMerge } from '~/unit/dashboard-thread/salon'
import Tabs from '~/widgets/Switcher/Tabs'

const seg = INFO_TABS.segment
const CRUMB_CONFIG = {
  title: 'dsb.crumb.workplace',
  seg,
  toSeg: DSB_COVERS.WORKPLACE,
  children: [
    { title: 'dsb.info.basic', seg },
    { title: 'dsb.info.logo', seg: `${seg}/logos` },
    { title: 'dsb.info.social', seg: `${seg}/social` },
    { title: 'common.other', seg: `${seg}/others` },
  ],
} satisfies TCrumbConfig

export default function Layout({ children }) {
  const s = useSalon()
  const { items, activeTab } = useDsbLayoutTabs(INFO_TABS)
  const { t } = useTrans()
  const crumbItems = useDsbCrumbItems(CRUMB_CONFIG)

  return (
    <div className={cnMerge(s.content, 'w-2/5')}>
      <Portal
        title={t('dashboard.info.portal.title')}
        desc={t('dashboard.info.portal.desc')}
        crumbItems={crumbItems}
        withDivider={false}
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
