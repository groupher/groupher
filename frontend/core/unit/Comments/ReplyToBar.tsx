import type { FC } from 'react'

// import { Wrapper } from './salon'
import { cutRest } from '~/fmt'
import useTrans from '~/hooks/useTrans'
import type { TComment } from '~/spec'

import useSalon from './salon/reply_to_bar'

type TProps = {
  comment: TComment
}

const ReplyToBar: FC<TProps> = ({ comment }) => {
  const s = useSalon()
  const { t } = useTrans()

  if (!comment) return null
  return (
    <div className={s.replyBar}>
      {t('comment.reply.to')}&nbsp;
      {cutRest(comment.author.nickname, 10)}:<div className={s.replyToBody}>{comment.bodyHtml}</div>
      <div className={s.replyToFloor}>#{comment.floor}</div>
    </div>
  )
}

export default ReplyToBar
