import { Fragment, useMemo } from 'react'

import Pagi from '~/widgets/Pagi'
import useTrans from '~/hooks/useTrans'

import List from './List'

import { useCommentsListState } from '../useLogic'
import useActions from '../useLogic/useActions'

export default () => {
  const { t } = useTrans()
  const { onPageChange } = useActions()
  const {
    mode,
    apiMode,
    loading,
    pagedComments,
    foldedCommentIds,
    repliesLoadingByParentId,
  } = useCommentsListState()

  const foldedIdSet = useMemo(() => new Set(foldedCommentIds), [foldedCommentIds])

  const { entries, totalCount, pageSize, pageNumber } = pagedComments

  return (
    <Fragment>
      <List
        mode={mode}
        apiMode={apiMode}
        entries={entries}
        foldedIdSet={foldedIdSet}
        repliesLoadingByParentId={repliesLoadingByParentId}
      />
      <div className="mb-14" />
      {!loading && (
        <Pagi
          pageNumber={pageNumber}
          pageSize={pageSize}
          totalCount={totalCount}
          onChange={onPageChange}
          showBottomMsg
          noMoreMsg={t('comment.list.no_more')}
          emptyMsg={t('comment.list.empty')}
        />
      )}
    </Fragment>
  )
}
