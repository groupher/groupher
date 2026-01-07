'use client'

import { useRouter } from 'next/navigation'

import { DSB_LAYOUT_ROUTE } from '~/const/route'
import VIEW from '~/const/view'
import Portal from '~/containers/thread/DashboardThread/Portal'
import useSalon from '~/containers/thread/DashboardThread/salon/layout'
import useCommunity from '~/hooks/useCommunity'
import useDashboard from '~/hooks/useDashboard'
import useSyncDSBRoute2Tab, { isRouteOf } from '~/hooks/useSyncDSBRoute2Tab'
import { LAYOUT_TABS } from '~/containers/thread/DashboardThread//constant'
import Tabs from '~/widgets/Switcher/Tabs'

export default ({ children }) => {
  const { slug } = useCommunity()
  const { layoutTab } = useDashboard()
  const router = useRouter()

  useSyncDSBRoute2Tab({
    tab: 'layoutTab',
    defaultTab: DSB_LAYOUT_ROUTE.GENERAL,
    validator: isRouteOf(DSB_LAYOUT_ROUTE),
  })

  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <Portal title='布局与样式' desc='社区板块自定义布局与全局样式。' withDivider={false} />
      <div className={s.banner}>
        <div className={s.tabs}>
          <Tabs
            items={LAYOUT_TABS}
            activeKey={layoutTab}
            onChange={(tab) => {
              const targetPath =
                tab === DSB_LAYOUT_ROUTE.GENERAL
                  ? `/${slug}/dashboard/layout`
                  : `/${slug}/dashboard/layout/${tab}`

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
