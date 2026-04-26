import type { FC } from 'react'

import { UPVOTE_LAYOUT } from '~/const/layout'
import SIZE from '~/const/size'
import { upvoteArticle } from '~/signal'
import type { TArticle } from '~/spec'
import CommentsCount from '~/unit/CommentsCount'
import Upvote from '~/unit/Upvote'
import DotDivider from '~/widgets/DotDivider'
import TimeAgo from '~/widgets/TimeAgo'

import useSalon from './salon/footer'

type TProps = {
  data: TArticle
}

const Footer: FC<TProps> = ({ data }) => {
  const s = useSalon()
  const { author, insertedAt, commentsCount, upvotesCount, viewerHasUpvoted, meta } = data

  return (
    <div className={s.wrapper}>
      <div className={s.publish}>
        {author.nickname} <DotDivider className='mx-1.5' />
        <TimeAgo datetime={insertedAt} />
      </div>
      <div className={s.bottom}>
        <Upvote
          type={UPVOTE_LAYOUT.GENERAL}
          count={upvotesCount}
          avatarList={meta.latestUpvotedUsers}
          viewerHasUpvoted={viewerHasUpvoted}
          onAction={(viewerHasUpvoted) => upvoteArticle(data, viewerHasUpvoted)}
        />

        {commentsCount !== 0 && <CommentsCount count={commentsCount} size={SIZE.MEDIUM} />}
      </div>
    </div>
  )
}

export default Footer
