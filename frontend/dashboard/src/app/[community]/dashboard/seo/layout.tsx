'use client'

import { DSB_COVERS, SEO_TABS } from '~/const/route'
import VIEW from '~/const/view'
import useDsbCrumbItems from '~/hooks/useDsbCrumbItems'
import useDsbLayoutTabs from '~/hooks/useDsbLayoutTabs'
import useTrans from '~/hooks/useTrans'
import type { TCrumbConfig } from '~/spec'
import { FIELD } from '~/unit/DashboardThread/constant'
import useSEO from '~/unit/DashboardThread/hooks/useSEO'
import Portal from '~/unit/DashboardThread/Portal'
import SavingBar from '~/unit/DashboardThread/SavingBar'
import useSalon, { cnMerge } from '~/unit/DashboardThread/salon'
import Tabs from '~/widgets/Switcher/Tabs'

const seg = SEO_TABS.segment
const CRUMB_CONFIG = {
  title: 'dsb.crumb.workplace',
  seg,
  toSeg: DSB_COVERS.WORKPLACE,
  children: [
    { title: 'dsb.crumb.search_engine', seg },
    { title: 'dsb.crumb.twitter', seg: `${seg}/twitter` },
  ],
} satisfies TCrumbConfig

export default function Layout({ children }) {
  const s = useSalon()

  const { saving, isTouched } = useSEO()
  const { items, activeTab } = useDsbLayoutTabs(SEO_TABS)
  const { t } = useTrans()
  const crumbItems = useDsbCrumbItems(CRUMB_CONFIG)

  return (
    <div className={cnMerge(s.content, 'w-2/5')}>
      <Portal
        title={t('dsb.portal.seo.title')}
        desc={t('dsb.portal.seo.desc')}
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
