'use client'

import { useRouter } from 'next/navigation'

import { DSB_ALIAS_ROUTE } from '~/const/route'
import VIEW from '~/const/view'
import { ALIAS_TABS } from '~/containers/thread/DashboardThread//constant'
import Portal from '~/containers/thread/DashboardThread//Portal'
import useSalon from '~/containers/thread/DashboardThread//salon/alias'
import useAlias from '~/containers/thread/DashboardThread/logic/useAlias'
import useCommunity from '~/hooks/useCommunity'
import useSyncDSBRoute2Tab, { isRouteOf } from '~/hooks/useSyncDSBRoute2Tab'
import Tabs from '~/widgets/Switcher/Tabs'

export default ({ children }) => {
  const s = useSalon()
  const router = useRouter()
  const curCommunity = useCommunity()
  const { aliasTab } = useAlias()

  useSyncDSBRoute2Tab({
    tab: 'aliasTab',
    defaultTab: DSB_ALIAS_ROUTE.THREAD,
    validator: isRouteOf(DSB_ALIAS_ROUTE),
  })

  return (
    <div className={s.wrapper}>
      <Portal
        title='别名设置'
        desc='覆盖社区内默认的板块，组件，提示信息等名称，注意对应的路由不会改变。'
        withDivider={false}
      />
      <div className={s.banner}>
        <div className={s.tabs}>
          <Tabs
            items={ALIAS_TABS}
            activeKey={aliasTab}
            onChange={(tab) => {
              const targetPath =
                tab === DSB_ALIAS_ROUTE.THREAD
                  ? `/${curCommunity.slug}/dashboard/alias`
                  : `/${curCommunity.slug}/dashboard/alias/${tab}`

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
