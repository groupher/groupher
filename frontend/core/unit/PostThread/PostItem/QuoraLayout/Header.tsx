import Link from 'next/link'
import { type FC, lazy, Suspense } from 'react'

import { COMMUNITY_LAYOUT } from '~/const/layout'
import SIZE from '~/const/size'
import { THREAD_PATH } from '~/const/thread'
import useLayout from '~/hooks/useLayout'
import type { TPost } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import CommentsCount from '~/unit/CommentsCount'
import TagsList from '~/unit/TagsList'
import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'
import TimeAgo from '~/widgets/TimeAgo'
import Tooltip from '~/widgets/Tooltip'

import ArticleReadLabel from '../../ArticleReadLabel'
import useSalon from '../salon/quora_layout/header'

const UserCard = lazy(() => import('~/widgets/Cards/UserCard'))

type TProps = {
  article: TPost
}

const Header: FC<TProps> = ({ article }) => {
  const { slug } = useCommunity()
  const { communityLayout } = useLayout()
  const { isPinned } = article

  const s = useSalon({ isPinned })

  const { author, title, commentsCount, innerId, communityTags, insertedAt } = article

  return (
    <section className={s.wrapper}>
      <div className={s.topping}>
        <Tooltip
          key={article.title}
          content={
            <Suspense fallback={<LavaLampLoading />}>
              <UserCard user={author} />
            </Suspense>
          }
          placement='bottom-start'
          offset={[-5, 0]}
          delay={500}
        >
          <div className={s.author}>{author.nickname}</div>
        </Tooltip>
        <div className={s.dot} />
        <div className='mr-0.5' />
        <div className={s.publish}>
          <TimeAgo datetime={insertedAt} />
        </div>
      </div>
      <div className={s.main}>
        <Link
          className={s.title}
          href={`/${slug}/${THREAD_PATH.POST}/${innerId}`}
          scroll={false}
          data-preview-id={String(innerId)}
        >
          <ArticleReadLabel viewed={article.viewerHasViewed} />
          {title}
        </Link>

        <TagsList items={communityTags} left={2} top='px' />
        <div className='grow' />
        {commentsCount !== 0 && (
          <CommentsCount
            count={commentsCount}
            size={SIZE.MEDIUM}
            right={communityLayout === COMMUNITY_LAYOUT.SIDEBAR ? 4 : 0}
          />
        )}
      </div>
    </section>
  )
}

export default Header
