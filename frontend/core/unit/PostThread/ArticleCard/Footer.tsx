import type { FC } from 'react'

import { UPVOTE_LAYOUT } from '~/const/layout'
import SIZE from '~/const/size'
import useArticleUpvote from '~/query/mutation/useArticleUpvote'
import type { TArticle, TArticleStats, TArticleViewerState } from '~/spec'
import DotDivider from '~/ui/DotDivider'
import TimeAgo from '~/ui/TimeAgo'
import CommentsCount from '~/unit/CommentsCount'
import PostTicketProgress from '~/unit/PostTicketProgress'
import Upvote from '~/unit/Upvote'

import useSalon from './salon/footer'

type TProps = {
  article: TArticle
  stats: TArticleStats | null
  viewerState: TArticleViewerState
  ticketProgress?: import('~/spec').TPostTicketProgress | null
}

const Footer: FC<TProps> = ({ article, stats, viewerState, ticketProgress }) => {
  const s = useSalon()
  const { author, insertedAt, meta } = article
  const { count, isUpvoted, toggle } = useArticleUpvote(article, stats, viewerState)

  return (
    <div className={s.wrapper}>
      <div className={s.publish}>
        {author?.nickname} <DotDivider className='mx-1.5' />
        {insertedAt && <TimeAgo datetime={insertedAt} />}
      </div>
      <div className={s.bottom}>
        <PostTicketProgress progress={ticketProgress} cat={article.cat} />
        <Upvote
          type={UPVOTE_LAYOUT.GENERAL}
          count={count}
          avatarList={meta?.latestUpvotedUsers}
          viewerHasUpvoted={isUpvoted}
          onAction={() => toggle()}
        />

        {(stats?.commentsCount ?? 0) !== 0 && (
          <CommentsCount count={stats?.commentsCount ?? 0} size={SIZE.MEDIUM} />
        )}
      </div>
    </div>
  )
}

export default Footer
