/*
 *
 * ArticleBaseStats
 *
 */

import type { FC } from 'react'

import { cn } from '~/css'
import { scrollToComments } from '~/dom'
import ViewSVG from '~/icons/article/Viewed'
import CommentSVG from '~/icons/Comment'
import type { TArticle, TContainer, TSpace } from '~/spec'

import useSalon from './salon'

type TProps = {
  testid?: string
  article: TArticle
  container?: TContainer
} & TSpace

const ArticleBaseStats: FC<TProps> = ({
  testid: _testid = 'article-base-stats',
  container = 'body',
  article,
  ...spacing
}) => {
  const s = useSalon({ ...spacing })
  const stats = article.articleStats

  return (
    <div className={s.wrapper}>
      <ViewSVG className={s.viewsIcon} />
      <div
        className={cn(s.count, stats === undefined && 'view-count-slot-detail')}
        aria-label='views'
      >
        {stats === undefined ? null : stats.views}
      </div>
      <div className={s.divider} />
      <button type='button' className={s.commentBox} onClick={() => scrollToComments(container)}>
        <CommentSVG className={s.commentIcon} />
        <div className={s.commentCount}>{stats?.commentsCount ?? 0}</div>
      </button>
    </div>
  )
}

export default ArticleBaseStats
