'use client'

/*
 *
 * ClassicSidebar
 * common sidebar include community badge, publisher, tags-bar ads .. etc,
 * used for classic layout
 *
 */

import Link from 'next/link'
import { lazy, Suspense } from 'react'
import TagsBar from '~/unit/tags-bar'
import useActiveTag from '~/hooks/useActiveTag'
import useCommunity from '~/stores/community/hooks'
import useCommunityDigestViewport from '~/hooks/useCommunityDigestViewport'
import useTrans from '~/hooks/useTrans'
import Img from '~/Img'
import LinkSVG from '~/icons/Link'
import { mockUsers } from '~/mock'
import { callGEditor, callSyncSelector, listUsers, refreshArticles } from '~/signal'
import PublishButton from '~/widgets/Buttons/PublishButton'
import GetMe from '~/unit/get-me'
import ImgFallback from '~/widgets/ImgFallback'
import SocialBanner from '../SocialBanner'
import useSalon from '../salon/thread_sidebar'
import CommunityBrief from './CommunityBrief'

const UniBar = lazy(() => import('../UniBar'))

export default function ThreadSidebar() {
  const { t } = useTrans()
  const { desc, homepage } = useCommunity()

  const { inView: showCommunityBadge } = useCommunityDigestViewport()
  const activeTag = useActiveTag()

  const s = useSalon()

  return (
    <div className={s.wrapper} data-test-id='thread-sidebar'>
      <div className={s.innerWrapper}>
        <div className={s.stickyWrapper}>
          <div className={s.showArea}>
            <SocialBanner />
            <div className={s.desc}>{desc}</div>
            <div className={s.homeLinks}>
              <LinkSVG className={s.linkIcon} />
              <Link href={homepage} className={s.link}>
                {homepage}
              </Link>
              <div className='grow' />

              <GetMe />
            </div>

            <h3 className={s.title}>{t('team.member', 'titleCase')}</h3>
            <div className='mt-6' />

            <div className={s.joiners}>
              {mockUsers(5).map((user) => (
                <Img
                  key={user.login}
                  className={s.joinAvatar}
                  src={user.avatar}
                  fallback={<ImgFallback right={2} user={user} />}
                />
              ))}
              <button className={s.moreNum} onClick={() => listUsers('drawer')}>
                +2
              </button>
            </div>
          </div>

          <div className={s.publish}>
            <PublishButton
              text='参与讨论'
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
