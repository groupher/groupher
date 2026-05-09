import type { FC } from 'react'

import { UPVOTE_LAYOUT } from '~/const/layout'
import { upvoteArticle } from '~/signal'
import type { TPost } from '~/spec'
import ArticleCatStatus from '~/unit/ArticleCatStatus'
import Upvote from '~/unit/Upvote'
import ViewsCount from '~/unit/ViewsCount'

import useSalon from '../salon/quora_layout/footer'

type TProps = {
  article: TPost
}

const Footer: FC<TProps> = ({ article }) => {
  const { upvotesCount, meta, viewerHasUpvoted } = article

  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <Upvote
        count={upvotesCount}
        avatarList={meta.latestUpvotedUsers}
        onAction={(viewerHasUpvoted) => upvoteArticle(article, viewerHasUpvoted)}
        viewerHasUpvoted={viewerHasUpvoted}
        type={UPVOTE_LAYOUT.GENERAL}
      />
      {article.cat && <ArticleCatStatus left={2} cat={article.cat} status={article.status} />}
      <ViewsCount count={article.views} left={3} />
    </div>
  )
}

export default Footer
