import { type FC, lazy, Suspense } from 'react'
import TimeAgo from 'timeago-react'

import type { TPost } from '~/spec'
import { previewArticle } from '~/signal'
import useViewingCommunity from '~/hooks/useViewingCommunity'
import useLayout from '~/hooks/useLayout'
import { THREAD } from '~/const/thread'
import { BANNER_LAYOUT } from '~/const/layout'
import SIZE from '~/const/size'

import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'
import ArticleReadLabel from '~/widgets/ArticleReadLabel'
import Tooltip from '~/widgets/Tooltip'
import TagsList from '~/widgets/TagsList'
import CommentsCount from '~/widgets/CommentsCount'

import useSalon from '../salon/quora_layout/header'

const UserCard = lazy(() => import('~/widgets/Cards/UserCard'))

type TProps = {
  article: TPost
}

const Header: FC<TProps> = ({ article }) => {
  const { slug } = useViewingCommunity()
  const { bannerLayout } = useLayout()
  const { isPinned } = article

  const s = useSalon({ isPinned })

  const { author, title, commentsCount, innerId, articleTags, insertedAt } = article

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
          placement="bottom-start"
          offset={[-5, 0]}
          delay={500}
        >
          <div className={s.author}>{author.nickname}</div>
        </Tooltip>
        <div className={s.dot} />
        <div className="mr-0.5" />
        <div className={s.publish}>
          <TimeAgo datetime={insertedAt} locale="zh_CN" suppressHydrationWarning />
        </div>
      </div>
      <div className={s.main}>
        <a
          className={s.title}
          onClick={(e) => {
            e.preventDefault()
            previewArticle(article)
          }}
          href={`/${slug}/${THREAD.POST}/${innerId}`}
        >
          <ArticleReadLabel viewed={article.viewerHasViewed} />
          {title}
        </a>

        {/*  @ts-ignore */}
        <TagsList items={articleTags} left={2} top="px" />
        <div className="grow" />
        {commentsCount !== 0 && (
          <CommentsCount
            count={commentsCount}
            size={SIZE.MEDIUM}
            right={bannerLayout === BANNER_LAYOUT.SIDEBAR ? 4 : 0}
          />
        )}
      </div>
    </section>
  )
}

export default Header
