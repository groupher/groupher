import type { FC } from 'react'
import Img from '~/Img'
import CheckBoldSVG from '~/icons/CheckBold'
import ExpandSVG from '~/icons/Expand'
import ReplyCurveSVG from '~/icons/ReplyCurve'
import type { TComment } from '~/spec'
import ImgFallback from '~/widgets/ImgFallback'
import TimeAgo from '~/widgets/TimeAgo'
import useTrans from '~/hooks/useTrans'
import useSalon, { cn } from '../../salon/comment/desktop_view/fold_layout'

import useActions from '../../useLogic/useActions'
import IllegalBar from './IllegalBar'

type TProps = {
  data: TComment
  isReply?: boolean
}

const FoldLayout: FC<TProps> = ({ data, isReply = false }) => {
  const s = useSalon()

  const { expandComment } = useActions()
  const { t } = useTrans()

  const isSolution = false //
  const { meta } = data
  const { isLegal, illegalReason, illegalWords } = meta

  return (
    <div className={s.wrapper} onClick={() => expandComment(data.id)}>
      {isReply && <ReplyCurveSVG className={s.replyCurve} />}
      <ExpandSVG className={s.expandIcon} />
      <Img
        className={s.avatar}
        src={data.author.avatar}
        fallback={<ImgFallback user={data.author} />}
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

      {data.repliesCount > 0 && (
        <div className={s.repliesHint}>
          [ {data.repliesCount} {t('comment.replies.count')} ]
        </div>
      )}

      {isSolution && (
        <CheckBoldSVG
          className={cn(s.solutionIcon, data.meta.isArticleAuthorUpvoted && 'mt-1.5')}
        />
      )}
      <div className={s.createDate}>
        <TimeAgo datetime={data.insertedAt} />
      </div>
    </div>
  )
}

export default FoldLayout
