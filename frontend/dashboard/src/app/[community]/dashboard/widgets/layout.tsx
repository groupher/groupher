'use client'

import { WIDGET_TABS } from '~/const/route'
import Portal from '~/containers/thread/DashboardThread//Portal'
import useSalon from '~/containers/thread/DashboardThread/salon/widgets'
import BaseSetting from '~/containers/thread/DashboardThread/Widgets/BaseSetting'
import useDsbRouteTab from '~/hooks/useDsbRouteTab'
import ViewSVG from '~/icons/article/Viewed'
import Button from '~/widgets/Buttons/Button'
import Tabs from '~/widgets/Switcher/Tabs'

export default ({ children }) => {
  const s = useSalon()

  const { items, activeTab } = useDsbRouteTab(WIDGET_TABS)

  return (
    <div className={s.wrapper}>
      <Portal
        title='网站插件'
        desc='为您的主页添加社区，更新日志，看板等插件，让产品用户及时方便的了解最新动态。'
      />
      <BaseSetting />
      <div className={s.typeSelect}>
        <div className={s.tabs}>
          <Tabs items={items} activeKey={activeTab} />
        </div>
        <Button size='small' space={8} ghost className='w-20'>
          <ViewSVG className={s.viewIcon} />
          预览
        </Button>
      </div>

      {children}
    </div>
  )
}
