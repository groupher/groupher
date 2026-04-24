import { useState } from 'react'

import { DSB_ROUTE } from '~/const/route'
import useTrans from '~/hooks/useTrans'
import useSalon from '../salon/dashboard_intros'
import AdminsTab from './AdminsTab'
import CMSTab from './CMSTab'
import HeadTabs from './HeadTabs'
import ImportTab from './ImportTab'
import IntegrateTab from './IntegrateTab'
import LayoutTab from './LayoutTab'
import LinksTab from './LinksTab'
import SeoTab from './SeoTab'
import SideIntros from './SideIntros'
import type { TIntroTab } from './spec'
import TagsTab from './TagsTab'
import TrendTab from './TrendTab'

export default function DashboardIntros() {
  const [tab, setTab] = useState<TIntroTab>(DSB_ROUTE.LAYOUT)
  const { t } = useTrans()

  const s = useSalon({ tab })

  return (
    <section className={s.wrapper}>
      <div className={s.slogan}>
        <h3 className={s.title}>{t('landing.dashboard.title')}</h3>
        <div className={s.desc}>{t('landing.dashboard.desc')}</div>
      </div>

      <HeadTabs tab={tab} onChange={(tab) => setTab(tab)} />

      <div className={s.content}>
        <div className={s.inner}>
          <SideIntros tab={tab} />

          <div className={s.bgGradientPurple} />
          <div className={s.bgGradientBlue} />
          <div className={s.bgGradientGreen} />
          <div className={s.bgGradientRed} />
          <div className={s.bgGradientBrown} />
          <div className={s.bgGradientCyan} />
          <div className={s.bgGradientYellow} />

          <div className={s.graphDemo}>
            {tab === DSB_ROUTE.LAYOUT && <LayoutTab />}
            {tab === DSB_ROUTE.SEO && <SeoTab />}
            {tab === DSB_ROUTE.POST && <CMSTab />}
            {tab === DSB_ROUTE.TAGS && <TagsTab />}
            {tab === DSB_ROUTE.ADMINS && <AdminsTab />}
            {tab === DSB_ROUTE.CLASSIC && <LinksTab />}
            {tab === DSB_ROUTE.WIDGETS && <IntegrateTab />}
            {tab === DSB_ROUTE.INOUT && <ImportTab />}
            {tab === DSB_ROUTE.TREND && <TrendTab />}
          </div>
        </div>
      </div>
    </section>
  )
}
