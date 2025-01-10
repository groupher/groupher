import type { FC } from 'react'

import type { TComment, TID } from '~/spec'

import type { TRepliesState, TAPIMode } from '../spec'
import TogglerButton from './TogglerButton'
import Comment from '../Comment'

import useLogic from '../useLogic'
import useSalon from '../salon/list/replies_list'

type TProps = {
  parentId: TID
  apiMode: TAPIMode
  entries: TComment[]
  repliesCount: number
  repliesState: TRepliesState
  foldedIds: TID[]
}

const RepliesList: FC<TProps> = ({
  parentId,
  apiMode,
  entries,
  repliesCount,
  repliesState,
  foldedIds,
}) => {
  const s = useSalon()

  const { loadCommentReplies } = useLogic()
  const loading = parentId === repliesState.repliesParentId && repliesState.repliesLoading

  return (
    <div className={s.wrapper}>
      {repliesCount > 0 && (
        <div className={s.countHint}>
          <div className={s.slashSign}>&#47;&#47;</div>
          <div className={s.countNum}>{repliesCount}</div> 条回复:
        </div>
      )}
      {entries.map((comment) => {
        return (
          <div key={comment.id} className={s.list}>
            <Comment apiMode={apiMode} data={comment} foldedIds={foldedIds} showInnerRef isReply />
          </div>
        )
      })}
      {repliesCount > entries.length && (
        <TogglerButton
          loading={loading}
          text={`更多回复 ( ${repliesCount - entries.length} )`}
          onClick={() => loadCommentReplies(parentId)}
        />
      )}
    </div>
  )
}

export default RepliesList
