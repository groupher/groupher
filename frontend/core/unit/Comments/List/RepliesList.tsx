import { memo, useState } from 'react'

import type { TComment, TID, TUser } from '~/spec'

import { useCommentFeed } from '../pagination/context'
import FeedProvider from '../pagination/FeedProvider'
import type { TAPIMode } from '../spec'
import ReplyPage from './ReplyPage'
import ReplySummary from './ReplySummary'
import useSalon from './salon/replies_list'

type TProps = {
  parentId: TID
  apiMode: TAPIMode
  entries: readonly TComment[]
  repliesCount: number
  participants: readonly TUser[]
  lastReplyAt?: string | null
  foldedIdSet: Set<TID>
}

/** Preview is replaced by page one on expansion; each root has its own query and controls. */
function RepliesList({
  parentId,
  apiMode,
  repliesCount,
  participants,
  lastReplyAt,
  foldedIdSet,
}: TProps) {
  const s = useSalon()
  const parentFeed = useCommentFeed()
  const [expanded, setExpanded] = useState(false)
  const [page, setPage] = useState(1)
  return (
    <div className={s.wrapper}>
      <ReplySummary
        participants={participants}
        count={repliesCount}
        lastReplyAt={lastReplyAt}
        expanded={expanded}
        onToggle={() => {
          setPage(1)
          setExpanded(!expanded)
        }}
      />
      {expanded ? (
        <FeedProvider
          collection={{
            ...parentFeed.collection,
            rootInnerId: String(parentId),
            initialAfter: undefined,
          }}
          config={{ ...parentFeed.config, api: 'cursor', mode: 'load_more' }}
          page={page}
          setPage={setPage}
        >
          <ReplyPage apiMode={apiMode} foldedIdSet={foldedIdSet} />
        </FeedProvider>
      ) : null}
    </div>
  )
}
export default memo(RepliesList)
