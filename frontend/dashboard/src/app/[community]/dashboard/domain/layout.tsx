'use client'

import { DOMAIN_TABS } from '~/const/route'
import VIEW from '~/const/view'
import Portal from '~/containers/thread/DashboardThread/Portal'
import useSalon, { cn } from '~/containers/thread/DashboardThread/salon/layout'
import useDsbLayoutTabs from '~/hooks/useDsbLayoutTabs'
import Tabs from '~/widgets/Switcher/Tabs'

export default ({ children }) => {
  const s = useSalon()
  const { items, activeTab } = useDsbLayoutTabs(DOMAIN_TABS)

  return (
    <div className={cn(s.wrapper, 'w-3/5')}>
      <div>
        <Portal title='域名设置' desc='给你的社区绑定个性化域名。' withDivider={false} />
        <div className={s.banner}>
          <div className={s.tabs}>
            <Tabs items={items} activeKey={activeTab} view={VIEW.DESKTOP} noAnimation />
          </div>
        </div>

        {children}
      </div>
    </div>
  )
}
