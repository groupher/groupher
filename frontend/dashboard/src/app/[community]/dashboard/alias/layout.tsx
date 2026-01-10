'use client'

import { ALIAS_TABS } from '~/const/route'
import VIEW from '~/const/view'
import Portal from '~/containers/thread/DashboardThread/Portal'
import useSalon from '~/containers/thread/DashboardThread/salon/alias'
import useDsbLayoutTab from '~/hooks/useDsbLayoutTab'
import Tabs from '~/widgets/Switcher/Tabs'

export default ({ children }) => {
  const s = useSalon()
  const { items, activeTab } = useDsbLayoutTab(ALIAS_TABS)

  return (
    <div className={s.wrapper}>
      <Portal
        title='别名设置'
        desc='覆盖社区内默认的板块，组件，提示信息等名称，注意对应的路由不会改变。'
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
