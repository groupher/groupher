/*
 *
 * Comments
 *
 */

import { type FC, useEffect } from 'react'

import { ANCHOR } from '~/const/dom'

// import NoticeBar from '~/widgets/NoticeBar'

import Editor from './Editor'
import List from './List'

// import LockedMessage from './LockedMessage'

import { API_MODE } from './constant'
import HeadBar from './HeadBar'
import useSalon from './salon'
import type { TAPIMode } from './spec'
import useLogic from './useLogic'

type TProps = {
  apiMode?: TAPIMode
  locked?: boolean
}

const Comments: FC<TProps> = ({ locked = false, apiMode = API_MODE.ARTICLE }) => {
  const s = useSalon()
  const { initialized, pagedComments, getEditState, loadComments } = useLogic()

  useEffect(() => {
    if (!initialized) {
      loadComments()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const editState = getEditState()
  const { totalCount } = pagedComments

  return (
    <div id={ANCHOR.COMMENTS_ID} className={s.wrapper}>
      {apiMode === API_MODE.ARTICLE && <Editor editState={editState} />}

      {/* <br />
      <NoticeBar
        type="lock"
        content="关闭了讨论: 已解决"
        timestamp={new Date().toLocaleDateString()}
        user={{ nickname: 'Bot' }}
        isArticleAuthor={false}
      /> */}
      {totalCount > 0 && <HeadBar />}
      <List />
    </div>
  )
}

export default Comments
