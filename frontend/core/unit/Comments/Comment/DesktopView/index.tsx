import { useContext, type FC } from 'react'
import { useSnapshot } from 'valtio'

import type { TComment } from '~/spec'
import { StoreContext } from '~/stores/comments/context'
import type { TStore } from '~/stores/comments/spec'
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
  const { data } = props
  const store = useContext(StoreContext) as TStore
  const local = useSnapshot(store)
  const isFolded =
    props.isFolded || (data.isFolded === true && !local.expandedCommentIds.includes(data.innerId))
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
