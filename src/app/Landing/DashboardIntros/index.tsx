import { useState } from 'react'

import { DASHBOARD_ROUTE } from '~/const/route'

import type { TIntroTab } from './spec'

import HeadTabs from './HeadTabs'
import SideIntros from './SideIntros'

import LayoutTab from './LayoutTab'
import SeoTab from './SeoTab'

import CMSTab from './CMSTab'
import TagsTab from './TagsTab'
import AdminsTab from './AdminsTab'
import LinksTab from './LinksTab'

import IntegrateTab from './IntegrateTab'
import ImportTab from './ImportTab'
import TrendTab from './TrendTab'

import useSalon from '../styles/dashboard_intros'

export default () => {
  const [tab, setTab] = useState<TIntroTab>(DASHBOARD_ROUTE.LAYOUT)

  const s = useSalon({ tab })

  return (
    <div className={s.wrapper}>
      <div className={s.slogan}>
        <h3 className={s.title}>完善的后台管理</h3>
        <div className={s.desc}>强大的自定义设置，满足你的品牌个性化及内容管理需要</div>
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
            {tab === DASHBOARD_ROUTE.LAYOUT && <LayoutTab />}
            {tab === DASHBOARD_ROUTE.SEO && <SeoTab />}
            {tab === DASHBOARD_ROUTE.POST && <CMSTab />}
            {tab === DASHBOARD_ROUTE.TAGS && <TagsTab />}
            {tab === DASHBOARD_ROUTE.ADMINS && <AdminsTab />}
            {tab === DASHBOARD_ROUTE.HEADER && <LinksTab />}
            {tab === DASHBOARD_ROUTE.WIDGETS && <IntegrateTab />}
            {tab === DASHBOARD_ROUTE.INOUT && <ImportTab />}
            {tab === DASHBOARD_ROUTE.TREND && <TrendTab />}
          </div>
        </div>
      </div>
    </div>
  )
}
