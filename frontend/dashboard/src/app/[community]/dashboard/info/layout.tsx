'use client'

import { DSB_COVERS, INFO_TABS } from '~/const/route'
import VIEW from '~/const/view'
import Portal from '~/containers/thread/DashboardThread/Portal'
import useSalon, { cn } from '~/containers/thread/DashboardThread/salon'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import useDsbLayoutTabs from '~/hooks/useDsbLayoutTabs'
import useTrans from '~/hooks/useTrans'
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
}

export default ({ children }) => {
  const s = useSalon()
  const { items, activeTab } = useDsbLayoutTabs(INFO_TABS)
  const { t } = useTrans()
  const crumbItems = useDsbCrumbItems(CRUMB_CONFIG)

  return (
    <div className={cn(s.content, 'w-2/5')}>
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
