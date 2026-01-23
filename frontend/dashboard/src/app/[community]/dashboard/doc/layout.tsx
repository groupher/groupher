'use client'

import { DOC_TABS, DSB_COVERS, DSB_ROUTE } from '~/const/route'
import VIEW from '~/const/view'
import AdminList from '~/containers/thread/DashboardThread/AdminList'
import Portal from '~/containers/thread/DashboardThread/Portal'
import useSalon, { cn } from '~/containers/thread/DashboardThread/salon'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import useDsbLayoutTabs from '~/hooks/useDsbLayoutTabs'
import { mockUsers } from '~/mock'
import Tabs from '~/widgets/Switcher/Tabs'

const seg = DSB_ROUTE.DOC
const CRUMB_CONFIG = {
  title: '内容管理',
  seg,
  toSeg: DSB_COVERS.CMS,
  children: [
    { title: '概览', seg },
    { title: '目录编排', seg: `${seg}/tree` },
    { title: '封面图标', seg: `${seg}/cover` },
    { title: '常见问题', seg: `${seg}/faq` },
  ],
}

export default function DashboardDocLayout({ children }) {
  const s = useSalon()
  const { items, activeTab } = useDsbLayoutTabs(DOC_TABS)
  const crumbItems = useDsbCrumbItems(CRUMB_CONFIG)

  const adminList = mockUsers(4)

  return (
    <div className={cn(s.content, 'w-full pl-10')}>
      <Portal
        title='文档管理'
        desc=''
        crumbItems={crumbItems}
        withDivider={false}
        addon={<AdminList userList={adminList} />}
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
