'use client'

import { DSB_COVERS, DSB_ROUTE } from '~/const/route'
import Portal from '~/containers/thread/DashboardThread/Portal'
import useSalon, { cn } from '~/containers/thread/DashboardThread/salon'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'

const seg = DSB_ROUTE.TAGS
const CRUMB_CONFIG = {
  title: '内容管理',
  seg,
  toSeg: DSB_COVERS.CMS,
  children: [{ title: '板块管理', seg }],
}

export default ({ children }) => {
  const s = useSalon()
  const crumbItems = useDsbCrumbItems(CRUMB_CONFIG)

  return (
    <div className={cn(s.content, 'w-1/2')}>
      <Portal
        title='标签设置'
        desc='编辑各板块标签，标签分组，颜色名称等均可编辑。'
        crumbItems={crumbItems}
      />

      {children}
    </div>
  )
}
