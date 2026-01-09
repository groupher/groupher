'use client'

import { LAYOUT_TABS_CFG } from '~/const/route'
import VIEW from '~/const/view'
import Portal from '~/containers/thread/DashboardThread/Portal'
import useSalon from '~/containers/thread/DashboardThread/salon/layout'
import useDsbRouteTab from '~/hooks/useDsbRouteTab'
import Tabs from '~/widgets/Switcher/Tabs'

export default ({ children }) => {
  const s = useSalon()
  const { items, activeTab } = useDsbRouteTab(LAYOUT_TABS_CFG)

  return (
    <div className={s.wrapper}>
      <Portal title='布局与样式' desc='社区板块自定义布局与全局样式。' withDivider={false} />
      <div className={s.banner}>
        <div className={s.tabs}>
          <Tabs items={items} activeKey={activeTab} view={VIEW.DESKTOP} noAnimation />
        </div>
      </div>

      {children}
    </div>
  )
}
