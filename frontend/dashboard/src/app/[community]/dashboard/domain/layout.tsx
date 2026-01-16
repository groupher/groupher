'use client'

import { DOMAIN_TABS, DSB_COVERS } from '~/const/route'
import VIEW from '~/const/view'
import Portal from '~/containers/thread/DashboardThread/Portal'
import useSalon, { cn } from '~/containers/thread/DashboardThread/salon'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import useDsbLayoutTabs from '~/hooks/useDsbLayoutTabs'
import Tabs from '~/widgets/Switcher/Tabs'

const seg = DOMAIN_TABS.segment
export const CRUMB_CONFIG = {
  title: '域名绑定',
  seg,
  toSeg: DSB_COVERS.INTEGRATIONS,
  children: [
    { title: '平台子域名', seg },
    { title: '自定义域名', seg: `${seg}/custom` },
  ],
}

export default ({ children }) => {
  const s = useSalon()
  const { items, activeTab } = useDsbLayoutTabs(DOMAIN_TABS)

  const crumbItems = useDsbCrumbItems(CRUMB_CONFIG)

  return (
    <div className={cn(s.content)}>
      <Portal
        title='域名设置'
        desc='给你的社区绑定个性化域名。'
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
