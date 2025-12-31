'use client'

import { useRouter } from 'next/navigation'

import { DSB_BROADCAST_ROUTE } from '~/const/route'
import VIEW from '~/const/view'
import { BROADCAST_TABS } from '~/containers//thread/DashboardThread/constant'
import Portal from '~/containers//thread/DashboardThread/Portal'
import useSalon from '~/containers//thread/DashboardThread/salon/broadcast'
import useCommunity from '~/hooks/useCommunity'
import useDashboard from '~/hooks/useDashboard'
import useSyncDSBRoute2Tab, { isRouteOf } from '~/hooks/useSyncDSBRoute2Tab'
import Tabs from '~/widgets/Switcher/Tabs'

export default ({ children }) => {
  const s = useSalon()

  useSyncDSBRoute2Tab({
    tab: 'broadcastTab',
    defaultTab: DSB_BROADCAST_ROUTE.GLOBAL,
    validator: isRouteOf(DSB_BROADCAST_ROUTE),
  })

  const router = useRouter()
  const community$ = useCommunity()
  const { broadcastTab } = useDashboard()

  return (
    <div className={s.wrapper}>
      <div className={s.banner}>
        <Portal title='布局/样式' desc='社区板块自定义布局与全局样式。' withDivider={false} />

        <div className={s.tabs}>
          <Tabs
            items={BROADCAST_TABS}
            activeKey={broadcastTab}
            onChange={(tab) => {
              const targetPath =
                tab === DSB_BROADCAST_ROUTE.GLOBAL
                  ? `/${community$.slug}/dashboard/broadcast`
                  : `/${community$.slug}/dashboard/broadcast/${tab}`

              router.push(targetPath)
            }}
            view={VIEW.DESKTOP}
            noAnimation
          />
        </div>
      </div>

      <div className={s.content}>{children}</div>
    </div>
  )
}
