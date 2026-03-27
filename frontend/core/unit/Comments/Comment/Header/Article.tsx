import type { FC } from 'react'
import useTrans from '~/hooks/useTrans'
import Img from '~/Img'
import type { TComment } from '~/spec'
import ImgFallback from '~/widgets/ImgFallback'
import TimeAgo from '~/widgets/TimeAgo'

import useSalon from '../../salon/comment/header/article'

type TProps = {
  data: TComment
  showInnerRef: boolean
  isReply: boolean
}

const CommentHeader: FC<TProps> = ({ data, showInnerRef, isReply }) => {
  const s = useSalon()
  const { t } = useTrans()

  const { author, meta } = data

  return (
    <div className={s.wrapper}>
      {isReply && (
        <div className={s.replyCurveBox}>
          <div className={s.replyCurve}></div>
        </div>
      )}
      <Img
        className={s.avatar}
        src={data.author.avatar}
        fallback={<ImgFallback user={data.author} right={2.5} />}
      />
      <div className={s.headerInfo}>
        <div className={s.baseInfo}>
          <div className={s.user}>
            <div className={s.nickname}>{author.nickname}</div>
            {data.isArticleAuthor && (
              <div className={s.authorTag}>{t('comment.header.post_author')}</div>
            )}
            {showInnerRef && meta.isReplyToOthers && (
              <div className={s.refToOther}>
                <div className={s.refLabel}>{t('comment.header.reply_to')}</div>
                <div className={s.refUser}>{data.replyTo?.author?.nickname}</div>
              </div>
            )}
            <div className={s.createDate}>
              <TimeAgo datetime={data.insertedAt} />
            </div>
          </div>

          <div className={s.floorNum}>
            #<span className='mr-0.5' />
            {data.floor}
          </div>
          <div className='mr-2.5' />
        </div>

        {author.bio && <div className={s.shortBio}>{author.bio}</div>}
      </div>
    </div>
  )
}

export default CommentHeader
