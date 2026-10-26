import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import CheckBoldSVG from '~/icons/CheckBold'
import ExpandSVG from '~/icons/Expand'
import ReplyCurveSVG from '~/icons/ReplyCurve'
import Img from '~/Img'
import type { TComment } from '~/spec'
import ImgFallback from '~/ui/ImgFallback'
import TimeAgo from '~/ui/TimeAgo'

import useActions from '../../useLogic/useActions'
import useSalon, { cn } from '../salon/desktop_view/fold_layout'

type TProps = {
  data: TComment
  isReply?: boolean
}

const FoldLayout: FC<TProps> = ({ data, isReply = false }) => {
  const s = useSalon()

  const { expandComment } = useActions()
  const { t } = useTrans()

  const isSolution = data.isSolution
  const author = data.author ?? {}

  return (
    <button type='button' className={s.wrapper} onClick={() => expandComment(data.innerId)}>
      {isReply && <ReplyCurveSVG className={s.replyCurve} />}
      <ExpandSVG className={s.expandIcon} />
      <Img
        className={s.avatar}
        src={author.avatar ?? ''}
        fallback={<ImgFallback user={author} />}
        noLazy
      />
      <div
        className={s.commentBody}
        // oxlint-disable-next-line react/no-danger -- Folded comment bodies use sanitized HTML from the backend renderer.
        dangerouslySetInnerHTML={{
          __html: data.body?.html ?? '',
        }}
      />

      {(data.repliesCount ?? 0) > 0 && (
        <div className={s.repliesHint}>
          [ {data.repliesCount} {t('comment.replies.count')} ]
        </div>
      )}

      {isSolution && (
        <CheckBoldSVG
          className={cn(s.solutionIcon, data.meta?.isArticleAuthorUpvoted && 'mt-1.5')}
        />
      )}
      <div className={s.createDate}>
        {data.insertedAt && <TimeAgo datetime={data.insertedAt} />}
      </div>
    </button>
  )
}

export default FoldLayout
