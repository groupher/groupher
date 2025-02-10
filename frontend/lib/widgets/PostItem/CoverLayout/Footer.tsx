import type { FC } from 'react'
import TimeAgo from 'timeago-react'

import type { TPost } from '~/spec'
import { UPVOTE_LAYOUT } from '~/const/layout'

import Upvote from '~/widgets/Upvote'

import useSalon from '../salon/cover_layout/footer'

type TProps = {
  article: TPost
}

const Footer: FC<TProps> = ({ article }) => {
  const s = useSalon()

  const { upvotesCount, meta, viewerHasUpvoted, insertedAt } = article

  return (
    <div className={s.wrapper}>
      <Upvote
        count={upvotesCount}
        avatarList={meta.latestUpvotedUsers}
        viewerHasUpvoted={viewerHasUpvoted}
        type={UPVOTE_LAYOUT.GENERAL}
        left={-2}
        top={-1}
      />
      <div className="grow" />
      <div className={s.createTime}>
        <TimeAgo datetime={insertedAt} locale="zh_CN" />
      </div>
    </div>
  )
}

export default Footer
