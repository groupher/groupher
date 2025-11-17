import { useRouter } from 'next/navigation'

import { DASHBOARD_LAYOUT_ROUTE } from '~/const/route'
import VIEW from '~/const/view'

import useViewingCommunity from '~/hooks/useViewingCommunity'
import { LAYOUT_TABS } from '~/stores/dashboard/constant'

import Tabs from '~/widgets/Switcher/Tabs'
import useTab from '../logic/useTab'
import Portal from '../Portal'
import useSalon from '../salon/layout'
import AvatarLayout from './AvatarLayout'
import BannerLayout from './BannerLayout'
import BrandLayout from './BrandLayout'
import ChangelogLayout from './ChangelogLayout'
import DocLayout from './DocLayout'
import GlowLight from './GlowLight'
import GossBlur from './GossBlur'
import KanbanLayout from './KanbanLayout'
import PageBackground from './PageBackground'
import PostLayout from './PostLayout'
import PrimaryColor from './PrimaryColor'
import TagLayout from './TagLayout'
import TopbarLayout from './TopbarLayout'
import Wallpaper from './Wallpaper'

export default () => {
  const curCommunity = useViewingCommunity()
  const router = useRouter()

  const s = useSalon()
  const { edit, layoutTab } = useTab()

  return (
    <div className={s.wrapper}>
      <Portal title='布局与样式' desc='社区板块自定义布局与全局样式。' withDivider={false} />
      <div className={s.banner}>
        <div className={s.tabs}>
          <Tabs
            items={LAYOUT_TABS}
            activeKey={layoutTab}
            onChange={(tab) => {
              edit(tab, 'layoutTab')
              const targetPath =
                tab === DASHBOARD_LAYOUT_ROUTE.GENERAL
                  ? `/${curCommunity.slug}/dashboard/layout`
                  : `/${curCommunity.slug}/dashboard/layout/${tab}`

              router.push(targetPath)
            }}
            view={VIEW.DESKTOP}
            noAnimation
          />
        </div>
      </div>

      {layoutTab === DASHBOARD_LAYOUT_ROUTE.GENERAL && (
        <>
          <BrandLayout />
          <div className={s.divider} />
          <BannerLayout />
          <div className={s.divider} />
          <AvatarLayout />
          <div className={s.divider} />
          <TagLayout />
          <div className={s.divider} />
          <TopbarLayout />
        </>
      )}

      {layoutTab === DASHBOARD_LAYOUT_ROUTE.THEME && (
        <>
          <PrimaryColor />
          <div className={s.divider} />
          <PageBackground />
          <div className={s.divider} />
          <Wallpaper />
          <div className={s.divider} />
          <GossBlur />
          <div className={s.divider} />
          <GlowLight />
        </>
      )}

      {layoutTab === DASHBOARD_LAYOUT_ROUTE.POST && <PostLayout />}

      {layoutTab === DASHBOARD_LAYOUT_ROUTE.KANBAN && <KanbanLayout />}

      {layoutTab === DASHBOARD_LAYOUT_ROUTE.CHANGELOG && <ChangelogLayout />}

      {layoutTab === DASHBOARD_LAYOUT_ROUTE.DOC && <DocLayout />}
    </div>
  )
}
