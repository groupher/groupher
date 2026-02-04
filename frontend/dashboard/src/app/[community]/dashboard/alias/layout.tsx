'use client'

import { ALIAS_TABS, DSB_COVERS } from '~/const/route'
import VIEW from '~/const/view'
import Portal from '~/containers/thread/DashboardThread/Portal'
import useSalon, { cn } from '~/containers/thread/DashboardThread/salon'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import useDsbLayoutTabs from '~/hooks/useDsbLayoutTabs'
import useTrans from '~/hooks/useTrans'
import type { TCrumbConfig } from '~/spec'
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

export default ({ children }) => {
  const s = useSalon()
  const { items, activeTab } = useDsbLayoutTabs(ALIAS_TABS)
  const crumbItems = useDsbCrumbItems(CRUMB_CONFIG)
  const { t } = useTrans()

  return (
    <div className={cn(s.content, 'w-1/2')}>
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
