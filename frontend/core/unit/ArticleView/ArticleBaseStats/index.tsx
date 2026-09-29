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
import type { TArticle, TArticleStats, TContainer, TSpace } from '~/spec'

import useSalon from './salon'

type TProps = {
  testid?: string
  article: TArticle
  stats: TArticleStats | null
  container?: TContainer
} & TSpace

const ArticleBaseStats: FC<TProps> = ({
  testid: _testid = 'article-base-stats',
  container = 'body',
  article,
  stats,
  ...spacing
}) => {
  const s = useSalon({ ...spacing })
  const statsUnavailable = stats === null || stats === undefined

  return (
    <div className={s.wrapper}>
      <ViewSVG className={s.viewsIcon} />
      <div className={cn(s.count, statsUnavailable && 'view-count-slot-detail')} aria-label='views'>
        {statsUnavailable ? null : stats.views}
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
