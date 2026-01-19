'use client'

import { DSB_COVERS, INFO_TABS } from '~/const/route'
import VIEW from '~/const/view'
import Portal from '~/containers/thread/DashboardThread/Portal'
import useSalon, { cn } from '~/containers/thread/DashboardThread/salon'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import useDsbLayoutTabs from '~/hooks/useDsbLayoutTabs'
import Tabs from '~/widgets/Switcher/Tabs'

const seg = INFO_TABS.segment
const CRUMB_CONFIG = {
  title: '工作区',
  seg,
  toSeg: DSB_COVERS.WORKPLACE,
  children: [
    { title: '基本信息', seg },
    { title: 'Logo', seg: `${seg}/logos` },
    { title: '社交媒体', seg: `${seg}/social` },
    { title: '其他', seg: `${seg}/others` },
  ],
}

export default ({ children }) => {
  const s = useSalon()
  const { items, activeTab } = useDsbLayoutTabs(INFO_TABS)
  const crumbItems = useDsbCrumbItems(CRUMB_CONFIG)

  return (
    <div className={cn(s.content, 'w-2/5')}>
      <Portal
        title='基本信息'
        desc='社区基本信息，社交媒体，关于页面主要信息等。'
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
