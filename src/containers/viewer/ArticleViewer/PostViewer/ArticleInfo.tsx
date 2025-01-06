import { memo, type FC } from 'react'

import type { TArticle } from '~/spec'

import { upvoteArticle } from '~/signal'
import { UPVOTE_LAYOUT } from '~/const/layout'

import Upvote from '~/widgets/Upvote'
import ArticleBaseStats from '~/widgets/ArticleBaseStats'

import useSalon from '../salon/post_viewer/article_info'

type TProps = {
  article: TArticle
}

const ArticleInfo: FC<TProps> = ({ article }) => {
  const s = useSalon()
  const { upvotesCount, viewerHasUpvoted, meta } = article

  return (
    <div className={s.wrapper}>
      <div className={s.baseWrapper}>
        <Upvote
          type={UPVOTE_LAYOUT.DEFAULT}
          count={upvotesCount}
          avatarList={meta.latestUpvotedUsers}
          viewerHasUpvoted={viewerHasUpvoted}
          onAction={(viewerHasUpvoted) => upvoteArticle(article, viewerHasUpvoted)}
        />
        <div className="grow" />
        <ArticleBaseStats article={article} container="drawer" />
      </div>
    </div>
  )
}

export default memo(ArticleInfo)
