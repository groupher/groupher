'use client'

import { useRouter } from 'next/navigation'
import { DSB_BASEINFO_ROUTE } from '~/const/route'
import VIEW from '~/const/view'
import { BASEINFO_TABS } from '~/containers/thread/DashboardThread/constant'
import Portal from '~/containers/thread/DashboardThread/Portal'
import useSalon from '~/containers/thread/DashboardThread/salon/basic_info'
import useCommunity from '~/hooks/useCommunity'
import useDashboard from '~/hooks/useDashboard'
import useSyncDSBRoute2Tab from '~/hooks/useSyncDSBRoute2Tab'
import type { TDsbBaseInfoRoute } from '~/spec'
import Tabs from '~/widgets/Switcher/Tabs'

const validator = (value: string): value is TDsbBaseInfoRoute => {
  return Object.values(DSB_BASEINFO_ROUTE).includes(value as TDsbBaseInfoRoute)
}

export default ({ children }) => {
  const s = useSalon()

  const router = useRouter()
  const { slug } = useCommunity()
  const { baseInfoTab } = useDashboard()

  useSyncDSBRoute2Tab({
    tab: 'baseInfoTab',
    defaultTab: DSB_BASEINFO_ROUTE.BASIC,
    validator,
  })

  return (
    <div className={s.wrapper}>
      <Portal
        title='社区信息'
        desc='社区基本信息，社交媒体，关于页面主要信息等。'
        withDivider={false}
      />

      <div className={s.banner}>
        <div className={s.tabs}>
          <Tabs
            items={BASEINFO_TABS}
            activeKey={baseInfoTab}
            onChange={(tab) => {
              // TODO: use Route.push to change the url, then the url will be sync to store by hook
              const targetPath =
                tab === DSB_BASEINFO_ROUTE.BASIC
                  ? `/${slug}/dashboard/info`
                  : `/${slug}/dashboard/info/${tab}`

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
