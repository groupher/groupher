import type { FC } from 'react'

import { UPVOTE_LAYOUT } from '~/const/layout'
import useArticleUpvote from '~/query/mutation/useArticleUpvote'
import type { TArticleStats, TArticleViewerState, TPost } from '~/spec'
import ArticleCatStatus from '~/unit/ArticleCatStatus'
import PostTicketProgress from '~/unit/PostTicketProgress'
import Upvote from '~/unit/Upvote'
import ViewsCount from '~/unit/ViewsCount'

import useSalon from '../salon/quora_layout/footer'

type TProps = {
  article: TPost
  stats: TArticleStats | null
  viewerState: TArticleViewerState
  ticketProgress?: import('~/spec').TPostTicketProgress | null
}

const Footer: FC<TProps> = ({ article, stats, viewerState, ticketProgress }) => {
  const { meta } = article

  const s = useSalon()
  const { count, isUpvoted, toggle } = useArticleUpvote(article, stats, viewerState)

  return (
    <div className={s.wrapper}>
      <Upvote
        count={count}
        avatarList={meta?.latestUpvotedUsers}
        onAction={() => toggle()}
        viewerHasUpvoted={isUpvoted}
        type={UPVOTE_LAYOUT.GENERAL}
      />
      {article.cat && <ArticleCatStatus left={2} cat={article.cat} />}
      <PostTicketProgress progress={ticketProgress} cat={article.cat} />
      <ViewsCount count={stats?.views ?? 0} left={3} />
    </div>
  )
}

export default Footer
