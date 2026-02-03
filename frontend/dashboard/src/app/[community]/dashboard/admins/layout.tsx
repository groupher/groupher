'use client'

import { DSB_COVERS, DSB_ROUTE } from '~/const/route'
import Portal from '~/containers/thread/DashboardThread/Portal'
import useSalon, { cnMerge } from '~/containers/thread/DashboardThread/salon'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import ArrowButton from '~/widgets/Buttons/ArrowButton'

const seg = DSB_ROUTE.ADMINS
const CRUMB_CONFIG = {
  title: '工作区',
  seg,
  toSeg: DSB_COVERS.WORKPLACE,
  children: [{ title: '管理员', seg }],
}

export default ({ children }) => {
  const s = useSalon()
  const crumbItems = useDsbCrumbItems(CRUMB_CONFIG)

  return (
    <div className={cnMerge(s.content, 'w-3/5')}>
      <Portal
        title='管理员'
        desc={
          <>
            添加可参与社区内容管理的账号。
            <div className='inline-block'>
              <ArrowButton>设置参考</ArrowButton>
            </div>
          </>
        }
        crumbItems={crumbItems}
      />
      {children}
    </div>
  )
}
