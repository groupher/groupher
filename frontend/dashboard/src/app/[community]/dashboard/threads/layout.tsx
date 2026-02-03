'use client'

import { DSB_COVERS, DSB_ROUTE } from '~/const/route'
import Portal from '~/containers/thread/DashboardThread/Portal'
import useSalon, { cnMerge } from '~/containers/thread/DashboardThread/salon'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'

const seg = DSB_ROUTE.THREADS
const CRUMB_CONFIG = {
  title: '工作区',
  seg,
  toSeg: DSB_COVERS.WORKPLACE,
  children: [{ title: '板块管理', seg }],
}

export default ({ children }) => {
  const s = useSalon()
  const crumbItems = useDsbCrumbItems(CRUMB_CONFIG)

  return (
    <div className={cnMerge(s.content, 'w-2/5')}>
      <Portal
        title='板块管理'
        desc='按需开启社区对外公开板块，关闭后不会导致内容删除。'
        crumbItems={crumbItems}
      />

      {children}
    </div>
  )
}
