import type { FC } from 'react'
import TimeAgo from 'timeago-react'

import type { TComment } from '~/spec'

import Img from '~/Img'
import ExpandSVG from '~/icons/Expand'
import CheckBoldSVG from '~/icons/CheckBold'
import ImgFallback from '~/widgets/ImgFallback'

import IllegalBar from './IllegalBar'

import useLogic from '../../useLogic'
import useSalon, { cn } from '../../salon/comment/desktop_view/fold_layout'

type TProps = {
  data: TComment
  isReply?: boolean
}

const FoldLayout: FC<TProps> = ({ data, isReply = false }) => {
  const s = useSalon()

  const { expandComment } = useLogic()

  const isSolution = false //
  const { meta } = data
  const { isLegal, illegalReason, illegalWords } = meta

  return (
    <div className={s.wrapper} onClick={() => expandComment(data.id)}>
      {isReply && <span>curve</span>}
      <ExpandSVG className={s.expandIcon} />
      <Img
        className={s.avatar}
        src={data.author.avatar}
        fallback={<ImgFallback user={data.author} size={16} />}
        noLazy
      />
      {isLegal ? (
        <div
          className={s.commentBody}
          dangerouslySetInnerHTML={{
            __html: data.bodyHtml,
          }}
        />
      ) : (
        <IllegalBar illegalReason={illegalReason} illegalWords={illegalWords} isFold />
      )}

      {data.repliesCount > 0 && <div className={s.repliesHint}>[ {data.repliesCount} 条回复 ]</div>}

      {isSolution && (
        <CheckBoldSVG
          className={cn(s.solutionIcon, data.meta.isArticleAuthorUpvoted && 'mt-1.5')}
        />
      )}
      <div className={s.createDate}>
        <TimeAgo datetime={data.insertedAt} locale="zh_CN" />
      </div>
    </div>
  )
}

export default FoldLayout
