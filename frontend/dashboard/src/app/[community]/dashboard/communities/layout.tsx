'use client'

import { DSB_COVERS, DSB_ROUTE } from '~/const/route'
import AdminList from '~/containers/thread/DashboardThread/AdminList'
import Portal from '~/containers/thread/DashboardThread/Portal'
import useSalon, { cnMerge } from '~/containers/thread/DashboardThread/salon'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import { mockUsers } from '~/mock'

const seg = DSB_ROUTE.COMMUNITIES
const CRUMB_CONFIG = {
  title: '内容管理',
  seg,
  toSeg: DSB_COVERS.CMS,
  children: [{ title: '所有社区', seg }],
}

const DashboardPostPage = ({ children }) => {
  const s = useSalon()
  const crumbItems = useDsbCrumbItems(CRUMB_CONFIG)

  const adminList = mockUsers(4)

  return (
    <div className={cnMerge(s.content, 'w-full pl-10')}>
      <Portal
        title='所有社区'
        desc=''
        crumbItems={crumbItems}
        addon={<AdminList userList={adminList} />}
      />
      {children}
    </div>
  )
}

export default DashboardPostPage
