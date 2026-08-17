'use client'

import { WIDGET_TABS } from '~/const/route'
import useDsbTabs from '~/hooks/useDsbTabs'
import useTrans from '~/hooks/useTrans'
import ViewSVG from '~/icons/article/Viewed'
import Button from '~/ui/Buttons/Button'
import Tabs from '~/ui/Switcher/Tabs'
import Portal from '~/unit/DashboardThread/Portal'
import BaseSetting from '~/unit/DashboardThread/Widgets/BaseSetting'
import useSalon from '~/unit/DashboardThread/Widgets/salon'

export default function Layout({ children }) {
  const s = useSalon()
  const { items, activeTab } = useDsbTabs(WIDGET_TABS)
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
