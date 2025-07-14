'use client'
/*
 *
 * ClassicSidebar
 * common sidebar include community badge, publisher, tagsbar ads .. etc,
 * used for classic layout
 *
 */

import { lazy, Suspense } from 'react'
import Link from 'next/link'

import useTrans from '~/hooks/useTrans'
import useCommunityDigestViewport from '~/hooks/useCommunityDigestViewport'
import useViewingCommunity from '~/hooks/useViewingCommunity'
import useActiveTag from '~/hooks/useActiveTag'

import { refreshArticles, callGEditor, callSyncSelector, listUsers } from '~/signal'
import { mockUsers } from '~/mock'

import ImgFallback from '~/widgets/ImgFallback'
import GetMe from '~/widgets/GetMe'
import SocialBanner from '~/widgets/SocialBanner'
import Img from '~/Img'
import LinkSVG from '~/icons/Link'

import PublishButton from '~/widgets/Buttons/PublishButton'
import TagsBar from '~/containers/unit/TagsBar'

import CommunityBrief from './CommunityBrief'
import useSalon from '../salon/thread_sidebar'

const UniBar = lazy(() => import('~/widgets/UniBar'))

export default () => {
  const { t } = useTrans()
  const curCommunity = useViewingCommunity()

  const { inView: showCommunityBadge } = useCommunityDigestViewport()
  const activeTag = useActiveTag()

  const s = useSalon()

  return (
    <div className={s.wrapper} data-test-id="thread-sidebar">
      <div className={s.innerWrapper}>
        <div className={s.stickyWrapper}>
          <div className={s.showArea}>
            <SocialBanner />
            <div className={s.desc}>{curCommunity.desc}</div>
            <div className={s.homeLinks}>
              <LinkSVG className={s.linkIcon} />
              <Link href={curCommunity.homepage} className={s.link}>
                {curCommunity.homepage}
              </Link>
              <div className="grow" />

              <GetMe />
            </div>

            <h3 className={s.title}>{t('team.member', 'titleCase')}</h3>
            <div className="mt-6" />

            <div className={s.joiners}>
              {mockUsers(5).map((user) => (
                <Img
                  key={user.login}
                  className={s.joinAvatar}
                  src={user.avatar}
                  fallback={<ImgFallback size={6} right={2} user={user} />}
                />
              ))}
              <div className={s.moreNum} onClick={() => listUsers('drawer')}>
                +2
              </div>
            </div>
          </div>

          <div className={s.publish}>
            <PublishButton
              text="参与讨论"
              onMenuSelect={(cat) => {
                callGEditor()
                setTimeout(() => callSyncSelector({ cat, tag: activeTag }), 500)
              }}
            />
          </div>

          <CommunityBrief />
          {!showCommunityBadge && <div className={s.divider} />}

          <div className={s.tagsBar}>
            <TagsBar onSelect={() => refreshArticles()} />
          </div>
        </div>

        <Suspense fallback={null}>
          <div className={s.unibarWrapper}>
            <UniBar />
          </div>
        </Suspense>
      </div>
    </div>
  )
}
