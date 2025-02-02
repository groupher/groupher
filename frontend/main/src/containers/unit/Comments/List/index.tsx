import { Fragment } from 'react'

import Pagi from '~/widgets/Pagi'

import List from './List'

import useLogic from '../useLogic'

export default () => {
  const { mode, apiMode, loading, getFoldState, getRepliesState, pagedComments, onPageChange } =
    useLogic()

  const foldState = getFoldState()
  const repliesState = getRepliesState()

  const { entries, totalCount, pageSize, pageNumber } = pagedComments
  const { foldedIds } = foldState

  return (
    <Fragment>
      <List
        mode={mode}
        apiMode={apiMode}
        entries={entries}
        repliesState={repliesState}
        foldedIds={foldedIds}
      />
      <div className="mb-14" />
      {!loading && (
        <Pagi
          pageNumber={pageNumber}
          pageSize={pageSize}
          totalCount={totalCount}
          onChange={onPageChange}
          showBottomMsg
          noMoreMsg="没有更多的讨论了"
          emptyMsg="目前还没有讨论"
        />
      )}
    </Fragment>
  )
}
