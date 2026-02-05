import { includes } from 'ramda'
import type { FC } from 'react'

import type { TComment, TID } from '~/spec'
import Comment from '../Comment'
import { MODE } from '../constant'
import { passedDate } from '../helper'
import useSalon from '../salon/list/list'
import type { TAPIMode, TMode, TRepliesState } from '../spec'
import useLogic from '../useLogic'
import DateDivider from './DateDivider'
import RepliesList from './RepliesList'

type TProps = {
  mode: TMode
  repliesState: TRepliesState
  apiMode: TAPIMode
  entries: TComment[]
  foldedIds: TID[]
}

const List: FC<TProps> = ({ mode, repliesState, apiMode, entries, foldedIds }) => {
  const s = useSalon()
  const { foldComment } = useLogic()

  return (
    <>
      {entries.map((comment, index) => (
        <div key={comment.id} className={s.wrapper}>
          <Comment
            data={comment}
            apiMode={apiMode}
            hasReplies={comment.repliesCount > 0}
            foldedIds={foldedIds}
          />

          {mode === MODE.TIMELINE && (
            <DateDivider text={passedDate(entries[index], entries[index + 1])} />
          )}

          {mode === MODE.REPLIES &&
            comment.replies?.length > 0 &&
            !includes(comment.id, foldedIds) && (
              <RepliesList
                parentId={comment.id}
                apiMode={apiMode}
                entries={comment.replies}
                repliesCount={comment.repliesCount}
                repliesState={repliesState}
                foldedIds={foldedIds}
              />
            )}

          <button className={s.indentLine} onClick={() => foldComment(comment.id)} />
        </div>
      ))}
    </>
  )
}

export default List
