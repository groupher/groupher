import Link from 'next/link'
import { BRAND_LAYOUT } from '~/const/layout'
import { HOME_COMMUNITY } from '~/const/name'
import { APPLY_COMMUNITY } from '~/const/route'
import { THREAD } from '~/const/thread'
import { assetSrc } from '~/helper'
import useCommunity from '~/hooks/useCommunity'
import useDashboard from '~/hooks/useDashboard'
import useLayout from '~/hooks/useLayout'
import usePublicThreads from '~/hooks/usePublicThreads'

import Img from '~/Img'
import ArrowSVG from '~/icons/ArrowUpRight'
import DiscussSVG from '~/icons/Discuss'
import GithubSVG from '~/icons/Github8'
import GuideSVG from '~/icons/Guide'
import AboutSVG from '~/icons/Info'
import KanbanSVG from '~/icons/Kanban'
import OptionArrowSVG from '~/icons/OptionArrow'
import PlusSVG from '~/icons/PlusCircle'
import SettingSVG from '~/icons/Setting'
import GlobalSVG from '~/icons/social/Global'
import ChangelogSVG from '~/icons/TadaRaw'
import ImgFallback from '~/widgets/ImgFallback'
import Tooltip from '~/widgets/Tooltip'

import useSalon, { cn } from '../salon/dashboard_layout/community_brief'

export default () => {
  const s = useSalon()

  const threads = usePublicThreads()
  const { title, logo, slug } = useCommunity()
  const dsb$ = useDashboard()
  const { brandLayout } = useLayout()

  return (
    <div className={s.wrapper}>
      <Img
        className={s.logo}
        src={HOME_COMMUNITY.logo}
        fallback={<ImgFallback title={title} />}
        visibleByDefault
      />

      <div className={s.slash}>/</div>

      <Tooltip
        content={
          <div className={s.topPanel}>
            <Link className={cn(s.panelItem, s.outside)} href={dsb$.homepage}>
              <GlobalSVG className={s.icon} />
              <div>返回官网</div>
              <div className='grow' />
              <ArrowSVG className={s.arrowIcon} />
            </Link>

            <Link className={cn(s.panelItem, s.outside)} href={`/${slug}`}>
              <GithubSVG className={s.icon} />
              <div>Github</div>
              <div className='grow' />
              <ArrowSVG className={s.arrowIcon} />
            </Link>

            <div className={s.divider} />
            <Link className={cn(s.panelItem, s.outside)} href={APPLY_COMMUNITY}>
              <PlusSVG className={s.icon} />
              <div>新社区</div>
              <div className='grow' />
              <ArrowSVG className={s.arrowIcon} />
            </Link>
          </div>
        }
        placement='bottom'
        hideOnClick={false}
        offset={[-7, -39]}
        trigger='click'
        noPadding
      >
        <div className={s.menuWrapper}>
          {brandLayout !== BRAND_LAYOUT.TEXT && (
            <Img className={s.logo} src={assetSrc(logo)} fallback={<ImgFallback title={title} />} />
          )}
          {brandLayout !== BRAND_LAYOUT.LOGO && <div className={s.title}>{title}</div>}

          <div className={s.levelLabel}>Free</div>

          <div className='mr-3' />
          <OptionArrowSVG className={s.optArrowIcon} />
        </div>
      </Tooltip>

      <div className={s.slash}>/</div>

      <Tooltip
        content={
          <div className={s.topPanel}>
            {threads.map((item) => {
              return (
                <Link key={item.slug} className={s.panelItem} href={`/${slug}/${item.slug}`}>
                  {item.slug === THREAD.POST && <DiscussSVG className={s.icon} />}
                  {item.slug === THREAD.KANBAN && <KanbanSVG className={s.icon} />}
                  {item.slug === THREAD.CHANGELOG && <ChangelogSVG className={s.icon} />}
                  {item.slug === THREAD.DOC && <GuideSVG className={s.icon} />}
                  <div>{item.title}</div>
                </Link>
              )
            })}

            <Link className={s.panelItem} href={`/${slug}/${THREAD.ABOUT}`}>
              <AboutSVG className={s.icon} />
              <div>关于</div>
            </Link>
          </div>
        }
        placement='bottom'
        hideOnClick={false}
        offset={[-7, -39]}
        trigger='click'
        noPadding
      >
        <div className={s.menuWrapper}>
          <SettingSVG className={cn(s.icon, 'mr-0')} />
          <div className={s.title}>管理后台</div>
          <div className='mr-3' />
          <OptionArrowSVG className={s.optArrowIcon} />
        </div>
      </Tooltip>
    </div>
  )
}
