'use client'

import { APPEARANCE_TABS, DSB_APPEARANCE_ROUTE, DSB_COVERS } from '~/const/route'
import VIEW from '~/const/view'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import useDsbTabs from '~/hooks/useDsbTabs'
import useTrans from '~/hooks/useTrans'
import type { TCrumbConfig } from '~/spec'
import Portal from '~/unit/DashboardThread/Portal'
import useSalon from '~/unit/DashboardThread/salon'
import Tabs from '~/widgets/Switcher/Tabs'

const seg = APPEARANCE_TABS.segment
const CRUMB_CONFIG = {
  title: 'dsb.crumb.workplace',
  seg,
  toSeg: DSB_COVERS.WORKPLACE,
  children: [
    { title: 'dsb.crumb.appearance.layout', seg },
    { title: 'dsb.crumb.appearance.theme', seg: `${seg}/${DSB_APPEARANCE_ROUTE.THEME}` },
    { title: 'dsb.crumb.appearance.wallpaper', seg: `${seg}/${DSB_APPEARANCE_ROUTE.WALLPAPER}` },
  ],
} satisfies TCrumbConfig

export default function Layout({ children }) {
  const s = useSalon()
  const { items, activeTab } = useDsbTabs(APPEARANCE_TABS)
  const { t } = useTrans()
  const crumbItems = useDsbCrumbItems(CRUMB_CONFIG)

  return (
    <div className={s.content}>
      <Portal
        title={t('dsb.portal.appearance.title')}
        desc={t('dsb.portal.appearance.desc')}
        withDivider={false}
        crumbItems={crumbItems}
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
