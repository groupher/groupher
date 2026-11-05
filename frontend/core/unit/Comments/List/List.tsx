import { useState, type CSSProperties, type FC } from 'react'

import useTrans from '~/hooks/useTrans'
import useViewingArticle from '~/hooks/useViewingArticle'
import type { TComment, TID } from '~/spec'
import ReferenceMap from '~/unit/ReferenceMap'

import Comment from '../Comment'
import { MODE } from '../constant'
import { passedDate } from '../helper'
import type { TAPIMode, TMode } from '../spec'
import useActions from '../useLogic/useActions'
import DateDivider from './DateDivider'
import RepliesList from './RepliesList'
import useSalon from './salon/list'

type TProps = {
  mode: TMode
  apiMode: TAPIMode
  entries: readonly TComment[]
  foldedIdSet: Set<TID>
}

const COMMENT_VISIBILITY_STYLE: CSSProperties = {
  contentVisibility: 'auto',
  containIntrinsicSize: '360px',
}

const List: FC<TProps> = ({ mode, apiMode, entries, foldedIdSet }) => {
  const s = useSalon()
  const { t } = useTrans()
  const { foldComment } = useActions()
  const { articlePath } = useViewingArticle()
  const [focusCommentId, setFocusCommentId] = useState<string | null>(null)

  return (
    <>
      {entries.map((comment, index) => {
        const isFolded = foldedIdSet.has(comment.innerId)

        return (
          <div
            key={comment.innerId}
            id={`comment-${comment.innerId}`}
            className={s.wrapper}
            style={COMMENT_VISIBILITY_STYLE}
          >
            <Comment
              data={comment}
              apiMode={apiMode}
              hasReplies={comment.hasReplyEntries === true}
              isFolded={isFolded}
            />

            <button
              type='button'
              className='text-accent text-sm hover:underline'
              onClick={() => setFocusCommentId(String(comment.innerId))}
            >
              {t('reference_map.title')}
            </button>
            {focusCommentId === String(comment.innerId) && (
              <ReferenceMap
                community={articlePath.community}
                focus={{
                  type: 'COMMENT',
                  articleInnerId: String(articlePath.innerId),
                  commentInnerId: String(comment.innerId),
                }}
              />
            )}

            {mode === MODE.TIMELINE && (
              <DateDivider text={passedDate(entries[index], entries[index + 1])} />
            )}

            {mode === MODE.REPLIES && comment.hasReplyEntries && !isFolded && (
              <RepliesList
                key={`${comment.innerId}`}
                parentId={comment.innerId}
                apiMode={apiMode}
                entries={comment.replies ?? []}
                repliesCount={comment.repliesCount ?? 0}
                participants={comment.replyParticipants ?? []}
                lastReplyAt={comment.lastReplyAt}
                foldedIdSet={foldedIdSet}
              />
            )}

            <button
              type='button'
              className={s.indentLine}
              aria-label={t('comment.collapse_replies')}
              onClick={() => foldComment(comment.innerId)}
            />
          </div>
        )
      })}
    </>
  )
}

export default List
