import type { FC } from 'react'

import type { TPost } from '~/spec'
import { UPVOTE_LAYOUT } from '~/const/layout'

import { upvoteArticle } from '~/signal'

import Upvote from '~/widgets/Upvote'
import ViewsCount from '~/widgets/ViewsCount'
import ArticleCatState from '~/widgets/ArticleCatState'

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
      {article.cat && <ArticleCatState left={2} cat={article.cat} state={article.state} />}
      <ViewsCount count={article.views} left={3} />
    </div>
  )
}

export default Footer
