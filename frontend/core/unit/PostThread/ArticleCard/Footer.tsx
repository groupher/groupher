import type { FC } from 'react'

import { UPVOTE_LAYOUT } from '~/const/layout'
import SIZE from '~/const/size'
import useArticleUpvote from '~/query/mutation/useArticleUpvote'
import type { TArticle } from '~/spec'
import DotDivider from '~/ui/DotDivider'
import TimeAgo from '~/ui/TimeAgo'
import CommentsCount from '~/unit/CommentsCount'
import Upvote from '~/unit/Upvote'

import useSalon from './salon/footer'

type TProps = {
  data: TArticle
}

const Footer: FC<TProps> = ({ data }) => {
  const s = useSalon()
  const { author, insertedAt, commentsCount, meta } = data
  const { count, isUpvoted, toggle } = useArticleUpvote(data)

  return (
    <div className={s.wrapper}>
      <div className={s.publish}>
        {author.nickname} <DotDivider className='mx-1.5' />
        <TimeAgo datetime={insertedAt} />
      </div>
      <div className={s.bottom}>
        <Upvote
          type={UPVOTE_LAYOUT.GENERAL}
          count={count}
          avatarList={meta.latestUpvotedUsers}
          viewerHasUpvoted={isUpvoted}
          onAction={() => toggle()}
        />

        {commentsCount !== 0 && <CommentsCount count={commentsCount} size={SIZE.MEDIUM} />}
      </div>
    </div>
  )
}

export default Footer
