'use client'

import { DOMAIN_TABS, DSB_COVERS } from '~/const/route'
import VIEW from '~/const/view'
import Portal from '~/containers/thread/DashboardThread/Portal'
import useSalon, { cn } from '~/containers/thread/DashboardThread/salon'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import useDsbLayoutTabs from '~/hooks/useDsbLayoutTabs'
import useTrans from '~/hooks/useTrans'
import type { TCrumbConfig } from '~/spec'
import Tabs from '~/widgets/Switcher/Tabs'

const seg = DOMAIN_TABS.segment
const CRUMB_CONFIG = {
  title: 'dsb.crumb.domain',
  seg,
  toSeg: DSB_COVERS.INTEGRATIONS,
  children: [
    { title: 'dsb.crumb.domain.platform', seg },
    { title: 'dsb.crumb.domain.custom', seg: `${seg}/custom` },
  ],
} satisfies TCrumbConfig

export default ({ children }) => {
  const s = useSalon()
  const { items, activeTab } = useDsbLayoutTabs(DOMAIN_TABS)
  const { t } = useTrans()

  const crumbItems = useDsbCrumbItems(CRUMB_CONFIG)

  return (
    <div className={cn(s.content)}>
      <Portal
        title={t('dsb.portal.domain.title')}
        desc={t('dsb.portal.domain.desc')}
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
