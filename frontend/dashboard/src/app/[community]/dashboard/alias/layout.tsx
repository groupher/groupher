'use client'

import { ALIAS_TABS, DSB_COVERS } from '~/const/route'
import VIEW from '~/const/view'
import Portal from '~/containers/thread/DashboardThread/Portal'
import useSalon from '~/containers/thread/DashboardThread/salon/alias'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import useDsbLayoutTabs from '~/hooks/useDsbLayoutTabs'
import Tabs from '~/widgets/Switcher/Tabs'

const seg = ALIAS_TABS.segment
const CRUMB_CONFIG = {
  title: '工作区',
  seg,
  toSeg: DSB_COVERS.WORKPLACE,
  children: [
    { title: '板块入口', seg },
    { title: '看板', seg: `${seg}/kanban` },
    { title: '其他', seg: `${seg}/others` },
  ],
}

export default ({ children }) => {
  const s = useSalon()
  const { items, activeTab } = useDsbLayoutTabs(ALIAS_TABS)
  const crumbItems = useDsbCrumbItems(CRUMB_CONFIG)

  return (
    <div className={s.wrapper}>
      <Portal
        title='别名设置'
        desc='覆盖社区内默认的板块，组件，提示信息等名称，注意对应的路由不会改变。'
        crumbItems={crumbItems}
        withDivider={false}
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
