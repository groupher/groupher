'use client'

import { BROADCAST_TABS } from '~/const/route'
import VIEW from '~/const/view'
import Portal from '~/containers/thread/DashboardThread/Portal'
import useSalon from '~/containers/thread/DashboardThread/salon/broadcast'
import useDsbLayoutTabs from '~/hooks/useDsbLayoutTabs'
import Tabs from '~/widgets/Switcher/Tabs'

export default ({ children }) => {
  const s = useSalon()
  const { items, activeTab } = useDsbLayoutTabs(BROADCAST_TABS)

  return (
    <div className={s.wrapper}>
      <div className={s.banner}>
        <Portal title='页面广播' desc='页面广播与通知设置。' withDivider={false} />

        <div className={s.tabs}>
          <Tabs items={items} activeKey={activeTab} view={VIEW.DESKTOP} noAnimation />
        </div>
      </div>

      <div className={s.content}>{children}</div>
    </div>
  )
}
