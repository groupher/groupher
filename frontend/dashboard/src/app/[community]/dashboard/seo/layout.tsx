'use client'

import { SEO_TABS } from '~/const/route'
import VIEW from '~/const/view'
import { FIELD } from '~/containers/thread/DashboardThread/constant'
import useSEO from '~/containers/thread/DashboardThread/logic/useSEO'
import Portal from '~/containers/thread/DashboardThread/Portal'
import SavingBar from '~/containers/thread/DashboardThread/SavingBar'
import useSalon from '~/containers/thread/DashboardThread/salon/seo'
import useDsbRouteTab from '~/hooks/useDsbRouteTab'
import Tabs from '~/widgets/Switcher/Tabs'

export default ({ children }) => {
  const s = useSalon()

  const { saving, isTouched } = useSEO()
  const { items, activeTab } = useDsbRouteTab(SEO_TABS)

  return (
    <div className={s.wrapper}>
      <Portal title='SEO' desc='搜索引擎及社交媒体展示优化。' withDivider={false} />

      <div className={s.banner}>
        <div className={s.tabs}>
          <Tabs items={items} activeKey={activeTab} view={VIEW.DESKTOP} noAnimation />
        </div>
      </div>

      {children}

      <SavingBar field={FIELD.SEO} isTouched={isTouched} loading={saving} width='7/12' />
    </div>
  )
}
