'use client'

import { DSB_COVERS, THIRD_PART_TABS } from '~/const/route'
import VIEW from '~/const/view'
import Portal from '~/containers/thread/DashboardThread/Portal'
import useSalon from '~/containers/thread/DashboardThread/salon/alias'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import useDsbLayoutTabs from '~/hooks/useDsbLayoutTabs'
import Tabs from '~/widgets/Switcher/Tabs'

const seg = THIRD_PART_TABS.segment
const CRUMB_CONFIG = {
  title: '绑定集成',
  seg,
  toSeg: DSB_COVERS.INTEGRATIONS,
  children: [
    { title: '统计分析', seg },
    { title: 'Webhooks', seg: `${seg}/webhooks` },
    { title: '消息机器人', seg: `${seg}/bots` },
    { title: '电子邮件', seg: `${seg}/email` },
    { title: '内容同步', seg: `${seg}/content-sync` },
  ],
}

export default ({ children }) => {
  const s = useSalon()
  const { items, activeTab } = useDsbLayoutTabs(THIRD_PART_TABS)
  const crumbItems = useDsbCrumbItems(CRUMB_CONFIG)

  return (
    <div className={s.wrapper}>
      <Portal
        title='绑定集成'
        desc='将社区与外部系统连接，实现数据同步、事件通知与协作管理。支持统计分析、Webhook 事件推送、即时通讯 Bot 及内容同步等集成方式。'
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
