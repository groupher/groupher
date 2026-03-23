'use client'

import { DSB_COVERS, DSB_ROUTE } from '~/const/route'
import AdminList from '~/unit/dashboard-thread/AdminList'
import Portal from '~/unit/dashboard-thread/Portal'
import useSalon, { cnMerge } from '~/unit/dashboard-thread/salon'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import useTrans from '~/hooks/useTrans'
import { mockUsers } from '~/mock'
import type { TCrumbConfig } from '~/spec'

const seg = DSB_ROUTE.POST
const CRUMB_CONFIG = {
  title: 'dsb.crumb.cms',
  seg,
  toSeg: DSB_COVERS.CMS,
  children: [{ title: 'dsb.crumb.post', seg }],
} satisfies TCrumbConfig

const DashboardPostPage = ({ children }) => {
  const s = useSalon()
  const crumbItems = useDsbCrumbItems(CRUMB_CONFIG)
  const { t } = useTrans()

  const adminList = mockUsers(4)

  return (
    <div className={cnMerge(s.content, 'w-full pl-10')}>
      <Portal
        title={t('dsb.portal.post.title')}
        desc={t('dsb.portal.post.desc')}
        crumbItems={crumbItems}
        addon={<AdminList userList={adminList} />}
      />
      {children}
    </div>
  )
}

export default DashboardPostPage
