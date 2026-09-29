import type { FC } from 'react'

import { UPVOTE_LAYOUT } from '~/const/layout'
import type { TArticleStats, TArticleViewerState, TPost } from '~/spec'
import TimeAgo from '~/ui/TimeAgo'
import Upvote from '~/unit/Upvote'

import useSalon from '../salon/cover_layout/footer'

type TProps = {
  article: TPost
  stats: TArticleStats | null
  viewerState: TArticleViewerState
}

const Footer: FC<TProps> = ({ article, stats, viewerState }) => {
  const s = useSalon()

  const { meta, insertedAt } = article

  return (
    <div className={s.wrapper}>
      <Upvote
        count={stats?.upvotesCount}
        avatarList={meta.latestUpvotedUsers}
        viewerHasUpvoted={viewerState.viewerHasUpvoted}
        type={UPVOTE_LAYOUT.GENERAL}
        left={-2}
        top={-1}
      />
      <div className='grow' />
      <div className={s.createTime}>
        <TimeAgo datetime={insertedAt} />
      </div>
    </div>
  )
}

export default Footer
