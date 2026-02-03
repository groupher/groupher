'use client'

import { DSB_COVERS, SEO_TABS } from '~/const/route'
import VIEW from '~/const/view'
import { FIELD } from '~/containers/thread/DashboardThread/constant'
import useSEO from '~/containers/thread/DashboardThread/logic/useSEO'
import Portal from '~/containers/thread/DashboardThread/Portal'
import SavingBar from '~/containers/thread/DashboardThread/SavingBar'
import useSalon, { cn } from '~/containers/thread/DashboardThread/salon'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import useDsbLayoutTabs from '~/hooks/useDsbLayoutTabs'
import Tabs from '~/widgets/Switcher/Tabs'

const seg = SEO_TABS.segment
const CRUMB_CONFIG = {
  title: '工作区',
  seg,
  toSeg: DSB_COVERS.WORKPLACE,
  children: [
    { title: '搜索引擎', seg },
    { title: 'Twitter', seg: `${seg}/twitter` },
  ],
}

export default ({ children }) => {
  const s = useSalon()

  const { saving, isTouched } = useSEO()
  const { items, activeTab } = useDsbLayoutTabs(SEO_TABS)
  const crumbItems = useDsbCrumbItems(CRUMB_CONFIG)

  return (
    <div className={cn(s.content, 'w-2/5')}>
      <Portal
        title='SEO'
        desc='搜索引擎及社交媒体展示优化。'
        crumbItems={crumbItems}
        withDivider={false}
      />

      <div className={s.banner}>
        <div className={s.tabs}>
          <Tabs items={items} activeKey={activeTab} view={VIEW.DESKTOP} noAnimation />
        </div>
      </div>

      {children}

      <SavingBar field={FIELD.SEO} isTouched={isTouched} loading={saving} />
    </div>
  )
}
