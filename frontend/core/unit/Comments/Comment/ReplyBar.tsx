import { type FC, memo } from 'react'

import { cutRest } from '~/fmt'
import ReplySVG from '~/icons/Reply'
import Img from '~/Img'
import type { TComment } from '~/spec'

import useSalon from '../salon/comment/reply_bar'

type TProps = {
  data: TComment
}

const CommentReplyBar: FC<TProps> = ({ data }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <ReplySVG className={s.replyIcon} />
      <Img src={data.author.avatar} className={s.avatar} noLazy />
      {cutRest(data.author.nickname, 20)}:
      <div
        className={s.replyToBody}
        // eslint-disable-next-line react/no-danger -- reply snippets are rendered from sanitized backend HTML
        dangerouslySetInnerHTML={{
          __html: data.bodyHtml,
        }}
      />
      <div className='grow' />
      <div className={s.replyToFloor}>#{data.floor}</div>
    </div>
  )
}

export default memo(CommentReplyBar)
