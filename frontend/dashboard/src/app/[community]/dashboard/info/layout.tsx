'use client'

import { INFO_TABS_CFG } from '~/const/route'
import VIEW from '~/const/view'
import Portal from '~/containers/thread/DashboardThread/Portal'
import useSalon from '~/containers/thread/DashboardThread/salon/basic_info'
import useDsbRouteTab from '~/hooks/useDsbRouteTab'
import Tabs from '~/widgets/Switcher/Tabs'

export default ({ children }) => {
  const s = useSalon()
  const { items, activeTab } = useDsbRouteTab(INFO_TABS_CFG)

  return (
    <div className={s.wrapper}>
      <Portal
        title='社区信息'
        desc='社区基本信息，社交媒体，关于页面主要信息等。'
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
