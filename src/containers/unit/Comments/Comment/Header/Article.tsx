import type { FC } from 'react'
import TimeAgo from 'timeago-react'

import type { TComment } from '~/spec'

import Img from '~/Img'
import ImgFallback from '~/widgets/ImgFallback'

import useSalon from '../../salon/comment/header/article'

type TProps = {
  data: TComment
  showInnerRef: boolean
  isReply: boolean
}

const CommentHeader: FC<TProps> = ({ data, showInnerRef, isReply }) => {
  const s = useSalon()

  const { author, meta } = data

  return (
    <div className={s.wrapper}>
      {isReply && <span>curve</span>}
      <Img
        className={s.avatar}
        src={data.author.avatar}
        fallback={<ImgFallback user={data.author} size={6} right={2.5} />}
      />
      <div className={s.headerInfo}>
        <div className={s.baseInfo}>
          <div className={s.user}>
            <div className={s.nickname}>{author.nickname}</div>
            {data.isArticleAuthor && <div className={s.authorTag}>发帖</div>}
            {showInnerRef && meta.isReplyToOthers && (
              <div className={s.refToOther}>
                <div className={s.refLabel}>回复:</div>
                <div className={s.refUser}>{data.replyTo?.author?.nickname}</div>
              </div>
            )}
            <div className={s.createDate}>
              <TimeAgo datetime={data.insertedAt} locale="zh_CN" />
            </div>
          </div>

          <div className={s.floorNum}>
            #<span className="mr-0.5" />
            {data.floor}
          </div>
          <div className="mr-2.5" />
        </div>

        {author.bio && <div className={s.shortBio}>{author.bio}</div>}
      </div>
    </div>
  )
}

export default CommentHeader
