'use client'

import { ALIAS_TABS, DSB_COVERS } from '~/const/route'
import VIEW from '~/const/view'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import useDsbTabs from '~/hooks/useDsbTabs'
import useTrans from '~/hooks/useTrans'
import type { TCrumbConfig } from '~/spec'
import Portal from '~/unit/DashboardThread/Portal'
import useSalon, { cnMerge } from '~/unit/DashboardThread/salon'
import Tabs from '~/widgets/Switcher/Tabs'

const seg = ALIAS_TABS.segment
const CRUMB_CONFIG = {
  title: 'dsb.crumb.workplace',
  seg,
  toSeg: DSB_COVERS.WORKPLACE,
  children: [
    { title: 'dsb.crumb.alias.thread', seg },
    { title: 'dsb.crumb.alias.kanban', seg: `${seg}/kanban` },
    { title: 'common.other', seg: `${seg}/others` },
  ],
} satisfies TCrumbConfig

export default function Layout({ children }) {
  const s = useSalon()
  const { items, activeTab } = useDsbTabs(ALIAS_TABS)
  const crumbItems = useDsbCrumbItems(CRUMB_CONFIG)
  const { t } = useTrans()

  return (
    <div className={cnMerge(s.content, 'w-1/2')}>
      <Portal
        title={t('dsb.portal.alias.title')}
        desc={t('dsb.portal.alias.desc')}
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
