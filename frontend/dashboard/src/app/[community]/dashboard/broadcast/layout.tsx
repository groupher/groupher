'use client'

import { BROADCAST_TABS } from '~/const/route'
import VIEW from '~/const/view'
import useDsbLayoutTabs from '~/hooks/useDsbLayoutTabs'
import useTrans from '~/hooks/useTrans'
import Portal from '~/unit/dashboard-thread/Portal'
import useSalon from '~/unit/dashboard-thread/salon/broadcast'
import Tabs from '~/widgets/Switcher/Tabs'

export default function Layout({ children }) {
  const s = useSalon()
  const { items, activeTab } = useDsbLayoutTabs(BROADCAST_TABS)
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <div className={s.banner}>
        <Portal
          title={t('dsb.portal.broadcast.title')}
          desc={t('dsb.portal.broadcast.desc')}
          withDivider={false}
        />

        <div className={s.tabs}>
          <Tabs items={items} activeKey={activeTab} view={VIEW.DESKTOP} noAnimation />
        </div>
      </div>

      <div className={s.content}>{children}</div>
    </div>
  )
}
