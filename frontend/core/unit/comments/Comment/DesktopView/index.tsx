import type { FC } from 'react'

import type { TComment } from '~/spec'
import type { TAPIMode } from '../../spec'

import DefaultLayout from './DefaultLayout'
import FoldLayout from './FoldLayout'

type TProps = {
  data: TComment
  apiMode: TAPIMode
  hasReplies?: boolean
  isFolded: boolean
  showInnerRef?: boolean
  isReply?: boolean
}

const Comment: FC<TProps> = (props) => {
  const { isFolded } = props

  return isFolded ? <FoldLayout {...props} /> : <DefaultLayout {...props} />
}

export default Comment
