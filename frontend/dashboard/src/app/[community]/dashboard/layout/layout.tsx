'use client'

import { DSB_COVERS, LAYOUT_TABS } from '~/const/route'
import VIEW from '~/const/view'
import Portal from '~/containers/thread/DashboardThread/Portal'
import useSalon from '~/containers/thread/DashboardThread/salon'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import useDsbLayoutTabs from '~/hooks/useDsbLayoutTabs'
import Button from '~/widgets/Buttons/Button'
import Tabs from '~/widgets/Switcher/Tabs'

const seg = LAYOUT_TABS.segment
const CRUMB_CONFIG = {
  title: '工作区',
  seg,
  toSeg: DSB_COVERS.WORKPLACE,
  children: [
    { title: '通用', seg },
    { title: '主题/背景', seg: `${seg}/theme` },
    { title: '讨论区', seg: `${seg}/post` },
    { title: '看板', seg: `${seg}/kanban` },
    { title: '更新日志', seg: `${seg}/changelog` },
    { title: '帮助台', seg: `${seg}/doc` },
  ],
}

export default ({ children }) => {
  const s = useSalon()
  const { items, activeTab } = useDsbLayoutTabs(LAYOUT_TABS)
  const crumbItems = useDsbCrumbItems(CRUMB_CONFIG)

  return (
    <div className={s.content}>
      <Portal
        title='布局与样式'
        desc='社区板块自定义布局与全局样式。'
        withDivider={false}
        crumbItems={crumbItems}
      />
      <div className={s.banner}>
        <div className={s.tabs}>
          <Tabs items={items} activeKey={activeTab} view={VIEW.DESKTOP} noAnimation />
        </div>
      </div>
      <div className='gap-5 mb-10 row-center wrap'>
        <Button type='red'>黑色传说</Button>
        <Button type='red' ghost>
          黑色传说
        </Button>

        <Button type='red' disabled>
          黑色传说 d
        </Button>
        <Button type='red' ghost disabled>
          黑色传说 d
        </Button>

        <Button>黑色传说</Button>
        <Button ghost>黑色传说</Button>
        <Button ghost disabled>
          dis & ghost
        </Button>
        <Button disabled>Disabled</Button>
      </div>

      {children}
    </div>
  )
}
