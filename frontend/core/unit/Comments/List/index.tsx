import { Fragment, useMemo } from 'react'

import useTrans from '~/hooks/useTrans'

import Controls from '../pagination/Controls'
import { useCommentsListState } from '../useLogic'
import CommentsList from './List'
import useCommentDeepLink from './useCommentDeepLink'

export default function List() {
  const { mode, apiMode, entries, foldedCommentIds } = useCommentsListState()
  const overlay = useCommentDeepLink(entries)
  const { t } = useTrans()

  const foldedIdSet = useMemo(() => new Set(foldedCommentIds), [foldedCommentIds])

  return (
    <Fragment>
      {overlay && (
        <section aria-label={t('comment.state.title')}>
          <CommentsList
            mode={mode}
            apiMode={apiMode}
            entries={[overlay]}
            foldedIdSet={foldedIdSet}
          />
        </section>
      )}
      <CommentsList mode={mode} apiMode={apiMode} entries={entries} foldedIdSet={foldedIdSet} />
      <div className='mb-14' />
      <Controls />
    </Fragment>
  )
}
