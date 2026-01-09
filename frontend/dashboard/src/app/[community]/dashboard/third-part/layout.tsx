'use client'

import { THIRD_PART_TABS } from '~/const/route'
import VIEW from '~/const/view'
import Portal from '~/containers/thread/DashboardThread//Portal'
import useSalon from '~/containers/thread/DashboardThread/salon/alias'
import useDsbRouteTab from '~/hooks/useDsbRouteTab'
import Tabs from '~/widgets/Switcher/Tabs'

export default ({ children }) => {
  const s = useSalon()
  const { items, activeTab } = useDsbRouteTab(THIRD_PART_TABS)

  return (
    <div className={s.wrapper}>
      <Portal
        title='绑定集成'
        desc='将社区与外部系统连接，实现数据同步、事件通知与协作管理。支持统计分析、Webhook 事件推送、即时通讯 Bot 及内容同步等集成方式。'
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
