import { type CSSProperties, type FC, memo } from 'react'

import useTrans from '~/hooks/useTrans'
import type { TComment, TID } from '~/spec'

import Comment from '../Comment'
import useSalon from './salon/replies_list'
import type { TAPIMode } from '../spec'
import useActions from '../useLogic/useActions'
import TogglerButton from './TogglerButton'

type TProps = {
  parentId: TID
  apiMode: TAPIMode
  entries: readonly TComment[]
  repliesCount: number
  loading: boolean
  foldedIdSet: Set<TID>
}

const REPLY_VISIBILITY_STYLE: CSSProperties = {
  contentVisibility: 'auto',
  containIntrinsicSize: '220px',
}

const RepliesList: FC<TProps> = ({
  parentId,
  apiMode,
  entries,
  repliesCount,
  loading,
  foldedIdSet,
}) => {
  const s = useSalon()
  const { t } = useTrans()

  const { loadCommentReplies } = useActions()

  return (
    <div className={s.wrapper}>
      {repliesCount > 0 && (
        <div className={s.countHint}>
          <div className={s.slashSign}>&#47;&#47;</div>
          <div className={s.countNum}>{repliesCount}</div> {t('comment.replies.count')}:
        </div>
      )}
      {entries.map((comment) => {
        return (
          <div key={comment.id} style={REPLY_VISIBILITY_STYLE}>
            <Comment
              apiMode={apiMode}
              data={comment}
              isFolded={foldedIdSet.has(comment.id)}
              showInnerRef
              isReply
            />
          </div>
        )
      })}
      {repliesCount > entries.length && (
        <TogglerButton
          loading={loading}
          text={`${t('comment.replies.more')} ( ${repliesCount - entries.length} )`}
          onClick={() => loadCommentReplies(parentId)}
        />
      )}
    </div>
  )
}

export default memo(RepliesList)
