import type { FC } from 'react'

import type { TComment } from '~/spec'
// import { ICON_CMD } from '~/config'
// import { Wrapper } from './styles'
import { cutRest } from '~/fmt'
import useSalon from './styles/reply_to_bar'

type TProps = {
  comment: TComment
}

const ReplyToBar: FC<TProps> = ({ comment }) => {
  const s = useSalon()

  if (!comment) return null
  return (
    <div className={s.replyBar}>
      回复&nbsp;
      {cutRest(comment.author.nickname, 10)}:<div className={s.replyToBody}>{comment.bodyHtml}</div>
      <div className={s.replyToFloor}>#{comment.floor}</div>
    </div>
  )
}

export default ReplyToBar
