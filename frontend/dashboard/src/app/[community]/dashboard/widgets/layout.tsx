'use client'

import { WIDGET_TABS } from '~/const/route'
import Portal from '~/containers/thread/DashboardThread/Portal'
import useSalon from '~/containers/thread/DashboardThread/salon/widgets'
import BaseSetting from '~/containers/thread/DashboardThread/Widgets/BaseSetting'
import useDsbLayoutTabs from '~/hooks/useDsbLayoutTabs'
import useTrans from '~/hooks/useTrans'
import ViewSVG from '~/icons/article/Viewed'
import Button from '~/widgets/Buttons/Button'
import Tabs from '~/widgets/Switcher/Tabs'

export default ({ children }) => {
  const s = useSalon()
  const { items, activeTab } = useDsbLayoutTabs(WIDGET_TABS)
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <Portal title={t('dsb.portal.widgets.title')} desc={t('dsb.portal.widgets.desc')} />
      <BaseSetting />
      <div className={s.typeSelect}>
        <div className={s.tabs}>
          <Tabs items={items} activeKey={activeTab} />
        </div>
        <Button size='small' space={8} ghost className='w-20'>
          <ViewSVG className={s.viewIcon} />
          {t('dsb.portal.widgets.preview')}
        </Button>
      </div>

      {children}
    </div>
  )
}
