'use client'

import { DSB_COVERS, DSB_ROUTE } from '~/const/route'
import Portal from '~/containers/thread/DashboardThread/Portal'
import useSalon, { cn } from '~/containers/thread/DashboardThread/salon'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'

const seg = DSB_ROUTE.FOOTER
export const CRUMB_CONFIG = {
  title: '工作区',
  seg,
  toSeg: DSB_COVERS.INTEGRATIONS,
  children: [{ title: '页脚', seg }],
}

export default ({ children }) => {
  const s = useSalon()

  const crumbItems = useDsbCrumbItems(CRUMB_CONFIG)

  return (
    <div className={cn(s.content, 'w-10/12 ml-20')}>
      <Portal
        title='页脚'
        desc='页脚模板样式，链接编组等设置。'
        withDivider={true}
        crumbItems={crumbItems}
      />

      {children}
    </div>
  )
}
