import type { FC } from 'react'

import type { TComment } from '~/spec'
import ReviewNotice from '~/unit/AlertWall/ReviewNotice'
import { useCommentFeed } from '~/unit/Comments/pagination/context'

import type { TAPIMode } from '../../spec'
import DefaultLayout from './DefaultLayout'
import FoldLayout from './FoldLayout'

type TProps = {
  data: TComment
  apiMode: TAPIMode
  hasReplies?: boolean
  isFolded: boolean
  showInnerRef?: boolean
  preview?: boolean
  isReply?: boolean
}

const Comment: FC<TProps> = (props) => {
  const { data, isFolded } = props
  const { collection } = useCommentFeed()
  const article = collection.article
  const reviewTarget =
    article?.innerId && article.thread
      ? {
          type: 'COMMENT' as const,
          comment: {
            article,
            innerId: data.innerId,
          },
        }
      : null

  return (
    <>
      {reviewTarget && <ReviewNotice target={reviewTarget} />}
      {isFolded ? <FoldLayout {...props} /> : <DefaultLayout {...props} />}
    </>
  )
}

export default Comment
