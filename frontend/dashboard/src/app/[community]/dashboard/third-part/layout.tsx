'use client'

import { useRouter } from 'next/navigation'
import { DSB_TAB, DSB_THIRD_PART_ROUTE } from '~/const/route'
import VIEW from '~/const/view'
import { THIRD_PART_TABS } from '~/containers/thread/DashboardThread//constant'
import Portal from '~/containers/thread/DashboardThread//Portal'
import useSalon from '~/containers/thread/DashboardThread//salon/alias'
import useThirdPart from '~/containers/thread/DashboardThread/logic/useThirdPart'
import useCommunity from '~/hooks/useCommunity'
import useSyncDSBRoute2Tab, { isRouteOf } from '~/hooks/useSyncDSBRoute2Tab'
import Tabs from '~/widgets/Switcher/Tabs'

export default ({ children }) => {
  const s = useSalon()
  const router = useRouter()
  const { slug: community } = useCommunity()
  const { thirdPartTab } = useThirdPart()

  useSyncDSBRoute2Tab({
    tab: DSB_TAB.THIRD_PART,
    defaultTab: DSB_THIRD_PART_ROUTE.ANALYTICS,
    validator: isRouteOf(DSB_THIRD_PART_ROUTE),
  })

  return (
    <div className={s.wrapper}>
      <Portal
        title='三方集成'
        desc='将社区与外部系统连接，实现数据同步、事件通知与协作管理。支持统计分析、Webhook 事件推送、即时通讯 Bot 及内容同步等集成方式。'
        withDivider={false}
      />
      <div className={s.banner}>
        <div className={s.tabs}>
          <Tabs
            items={THIRD_PART_TABS}
            activeKey={thirdPartTab}
            onChange={(tab) => {
              const targetPath =
                tab === DSB_THIRD_PART_ROUTE.ANALYTICS
                  ? `/${community}/dashboard/third-part`
                  : `/${community}/dashboard/third-part/${tab}`

              router.push(targetPath)
            }}
            view={VIEW.DESKTOP}
            noAnimation
          />
        </div>
      </div>
      {children}
    </div>
  )
}
