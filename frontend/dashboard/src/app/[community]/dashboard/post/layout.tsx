'use client'

import { DSB_COVERS, DSB_ROUTE } from '~/const/route'
import Portal from '~/containers/thread/DashboardThread/Portal'
import useSalon from '~/containers/thread/DashboardThread/salon/cms'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import 'rsuite-table/dist/css/rsuite-table.css'
import '~/containers/thread/DashboardThread/salon/cms/global.css'

const seg = DSB_ROUTE.POST
const CRUMB_CONFIG = {
  title: '内容管理',
  seg,
  toSeg: DSB_COVERS.CMS,
  children: [{ title: '帖子', seg }],
}

const DashboardPostPage = ({ children }) => {
  const s = useSalon()
  const crumbItems = useDsbCrumbItems(CRUMB_CONFIG)

  return (
    <div className={s.wrapper}>
      <Portal title='帖子管理(TODO: 右侧管理员头像列表)' desc='' crumbItems={crumbItems} />

      {children}
    </div>
  )
}

export default DashboardPostPage
