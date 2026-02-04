'use client'

import { DOC_TABS, DSB_COVERS, DSB_ROUTE } from '~/const/route'
import VIEW from '~/const/view'
import AdminList from '~/containers/thread/DashboardThread/AdminList'
import Portal from '~/containers/thread/DashboardThread/Portal'
import useSalon, { cn } from '~/containers/thread/DashboardThread/salon'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import useDsbLayoutTabs from '~/hooks/useDsbLayoutTabs'
import useTrans from '~/hooks/useTrans'
import { mockUsers } from '~/mock'
import type { TCrumbConfig } from '~/spec'
import Tabs from '~/widgets/Switcher/Tabs'

const seg = DSB_ROUTE.DOC
const CRUMB_CONFIG = {
  title: 'dsb.crumb.cms',
  seg,
  toSeg: DSB_COVERS.CMS,
  children: [
    { title: 'dsb.crumb.doc.table', seg },
    { title: 'dsb.crumb.doc.tree', seg: `${seg}/tree` },
    { title: 'dsb.crumb.doc.cover', seg: `${seg}/cover` },
    { title: 'dsb.crumb.doc.faq', seg: `${seg}/faq` },
  ],
} satisfies TCrumbConfig

export default function DashboardDocLayout({ children }) {
  const s = useSalon()
  const { items, activeTab } = useDsbLayoutTabs(DOC_TABS)
  const crumbItems = useDsbCrumbItems(CRUMB_CONFIG)
  const { t } = useTrans()

  const adminList = mockUsers(4)

  return (
    <div className={cn(s.content, 'w-full pl-10')}>
      <Portal
        title={t('dsb.portal.doc.title')}
        desc={t('dsb.portal.doc.desc')}
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
