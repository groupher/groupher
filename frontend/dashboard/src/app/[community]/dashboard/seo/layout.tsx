'use client'

import { useRouter } from 'next/navigation'

import { DSB_SEO_ROUTE, DSB_TAB } from '~/const/route'
import VIEW from '~/const/view'
import { FIELD, SEO_TABS } from '~/containers/thread/DashboardThread/constant'
import useSEO from '~/containers/thread/DashboardThread/logic/useSEO'
import Portal from '~/containers/thread/DashboardThread/Portal'
import SavingBar from '~/containers/thread/DashboardThread/SavingBar'
import useSalon from '~/containers/thread/DashboardThread/salon/seo'
import useCommunity from '~/hooks/useCommunity'
import useSyncDSBRoute2Tab, { isRouteOf } from '~/hooks/useSyncDSBRoute2Tab'
import Tabs from '~/widgets/Switcher/Tabs'

export default ({ children }) => {
  const s = useSalon()

  useSyncDSBRoute2Tab({
    tab: DSB_TAB.SEO,
    defaultTab: DSB_SEO_ROUTE.SEARCH_ENGINE,
    validator: isRouteOf(DSB_SEO_ROUTE),
  })

  const router = useRouter()
  const community$ = useCommunity()
  const { seoTab, saving, isTouched } = useSEO()

  return (
    <div className={s.wrapper}>
      <Portal title='SEO' desc='搜索引擎及社交媒体展示优化。' withDivider={false} />

      <div className={s.banner}>
        <div className={s.tabs}>
          <Tabs
            items={SEO_TABS}
            activeKey={seoTab}
            onChange={(tab) => {
              const targetPath =
                tab === DSB_SEO_ROUTE.SEARCH_ENGINE
                  ? `/${community$.slug}/dashboard/seo`
                  : `/${community$.slug}/dashboard/seo/${tab}`

              router.push(targetPath)
            }}
            view={VIEW.DESKTOP}
            noAnimation
          />
        </div>
      </div>

      {children}

      <SavingBar field={FIELD.SEO} isTouched={isTouched} loading={saving} width='7/12' />
    </div>
  )
}
