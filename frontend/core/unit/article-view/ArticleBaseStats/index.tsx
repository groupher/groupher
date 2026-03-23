/*
 *
 * ArticleBaseStats
 *
 */

import type { FC } from 'react'
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
  testid = 'article-base-stats',
  container = 'body',
  article,
  ...spacing
}) => {
  const s = useSalon({ ...spacing })

  return (
    <div className={s.wrapper}>
      <ViewSVG className={s.viewsIcon} />
      <div className={s.count}>{article.views}</div>
      <div className={s.divider} />
      <div className={s.commentBox} onClick={() => scrollToComments(container)}>
        <CommentSVG className={s.commentIcon} />
        <div className={s.commentCount}>{article.commentsCount}</div>
      </div>
    </div>
  )
}

export default ArticleBaseStats
