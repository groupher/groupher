'use client'

import { DSB_COVERS, DSB_ROUTE } from '~/const/route'
import AdminList from '~/containers/thread/DashboardThread/AdminList'
import Portal from '~/containers/thread/DashboardThread/Portal'
import useSalon, { cn } from '~/containers/thread/DashboardThread/salon'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import useTrans from '~/hooks/useTrans'
import { mockUsers } from '~/mock'

const seg = DSB_ROUTE.CHANGELOG
const CRUMB_CONFIG = {
  title: 'dsb.crumb.cms',
  seg,
  toSeg: DSB_COVERS.CMS,
  children: [{ title: 'dsb.crumb.changelog', seg }],
}

const DashboardPostPage = ({ children }) => {
  const s = useSalon()
  const crumbItems = useDsbCrumbItems(CRUMB_CONFIG)
  const { t } = useTrans()

  const adminList = mockUsers(4)

  return (
    <div className={cn(s.content, 'w-full pl-10')}>
      <Portal
        title={t('dsb.portal.changelog.title')}
        desc={t('dsb.portal.changelog.desc')}
        crumbItems={crumbItems}
        addon={<AdminList userList={adminList} />}
      />
      {children}
    </div>
  )
}

export default DashboardPostPage
