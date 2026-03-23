import type { FC } from 'react'
import type { CSSProperties } from 'react'

import type { TComment, TID } from '~/spec'
import Comment from '../Comment'
import { MODE } from '../constant'
import { passedDate } from '../helper'
import useSalon from '../salon/list/list'
import type { TAPIMode, TMode } from '../spec'
import useActions from '../useLogic/useActions'
import DateDivider from './DateDivider'
import RepliesList from './RepliesList'

type TProps = {
  mode: TMode
  repliesLoadingByParentId: Record<string, boolean>
  apiMode: TAPIMode
  entries: readonly TComment[]
  foldedIdSet: Set<TID>
}

const COMMENT_VISIBILITY_STYLE: CSSProperties = {
  contentVisibility: 'auto',
  containIntrinsicSize: '360px',
}

const List: FC<TProps> = ({
  mode,
  repliesLoadingByParentId,
  apiMode,
  entries,
  foldedIdSet,
}) => {
  const s = useSalon()
  const { foldComment } = useActions()

  return (
    <>
      {entries.map((comment, index) => {
        const isFolded = foldedIdSet.has(comment.id)
        const isRepliesLoading = Boolean(repliesLoadingByParentId[comment.id])

        return (
          <div key={comment.id} className={s.wrapper} style={COMMENT_VISIBILITY_STYLE}>
            <Comment
              data={comment}
              apiMode={apiMode}
              hasReplies={comment.repliesCount > 0}
              isFolded={isFolded}
            />

            {mode === MODE.TIMELINE && (
              <DateDivider text={passedDate(entries[index], entries[index + 1])} />
            )}

            {mode === MODE.REPLIES && comment.replies?.length > 0 && !isFolded && (
              <RepliesList
                parentId={comment.id}
                apiMode={apiMode}
                entries={comment.replies}
                repliesCount={comment.repliesCount}
                loading={isRepliesLoading}
                foldedIdSet={foldedIdSet}
              />
            )}

            <button className={s.indentLine} onClick={() => foldComment(comment.id)} />
          </div>
        )
      })}
    </>
  )
}

export default List
