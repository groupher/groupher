import Link from 'next/link'

import { BRAND_LAYOUT } from '~/const/layout'
import { APPLY_COMMUNITY } from '~/const/route'
import { THREAD_PATH } from '~/const/thread'
import { assetSrc } from '~/helper'
import useLayout from '~/hooks/useLayout'
import usePublicThreads from '~/hooks/usePublicThreads'
import useTrans from '~/hooks/useTrans'
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
import Img from '~/Img'
import useCommunity from '~/stores/community/hooks'
import useDashboard from '~/stores/dashboard/hooks'
import ImgFallback from '~/widgets/ImgFallback'
import Tooltip from '~/widgets/Tooltip'

import useSalon, { cn, cnMerge } from '../salon/dashboard_layout/community_brief'

export default function CommunityBrief() {
  const s = useSalon()

  const threads = usePublicThreads()
  const { title, logo, slug } = useCommunity()
  const dsb$ = useDashboard()
  const { brandLayout } = useLayout()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <Tooltip
        content={
          <div className={s.topPanel}>
            <Link className={cn(s.panelItem, s.outside)} href={dsb$.homepage}>
              <GlobalSVG className={s.icon} />
              <div>{t('dsb.community_brief.back_home')}</div>
              <div className='grow' />
              <ArrowSVG className={s.arrowIcon} />
            </Link>

            <Link className={cn(s.panelItem, s.outside)} href={`/${slug}`}>
              <GithubSVG className={s.icon} />
              <div>{t('dsb.community_brief.github')}</div>
              <div className='grow' />
              <ArrowSVG className={s.arrowIcon} />
            </Link>

            <div className={s.divider} />
            <Link className={cn(s.panelItem, s.outside)} href={APPLY_COMMUNITY}>
              <PlusSVG className={s.icon} />
              <div>{t('dsb.community_brief.new_community')}</div>
              <div className='grow' />
              <ArrowSVG className={s.arrowIcon} />
            </Link>
          </div>
        }
        placement='bottom'
        hideOnClick={false}
        offset={[0, -36]}
        trigger='click'
        noPadding
      >
        <div className={s.menuWrapper}>
          {brandLayout !== BRAND_LAYOUT.TEXT && (
            <Img className={s.logo} src={assetSrc(logo)} fallback={<ImgFallback title={title} />} />
          )}
          {brandLayout !== BRAND_LAYOUT.LOGO && <div className={s.title}>{title}</div>}

          <div className={s.levelLabel}>{t('dsb.community_brief.plan_free')}</div>

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
                  {item.slug === THREAD_PATH.POST && <DiscussSVG className={s.icon} />}
                  {item.slug === THREAD_PATH.KANBAN && <KanbanSVG className={s.icon} />}
                  {item.slug === THREAD_PATH.CHANGELOG && <ChangelogSVG className={s.icon} />}
                  {item.slug === THREAD_PATH.DOC && <GuideSVG className={s.icon} />}

                  {item.slug !== THREAD_PATH.ABOUT && <div>{item.title}</div>}
                </Link>
              )
            })}

            <Link className={s.panelItem} href={`/${slug}/${THREAD_PATH.ABOUT}`}>
              <AboutSVG className={s.icon} />
              <div>{t('dsb.community_brief.about')}</div>
            </Link>
          </div>
        }
        placement='bottom'
        hideOnClick={false}
        offset={[0, -36]}
        trigger='click'
        noPadding
      >
        <div className={s.menuWrapper}>
          <SettingSVG className={cnMerge(s.icon, 'mr-0')} />
          <div className={s.title}>{t('dsb.community_brief.dashboard')}</div>
          <div className='mr-3' />
          <OptionArrowSVG className={s.optArrowIcon} />
        </div>
      </Tooltip>
    </div>
  )
}
