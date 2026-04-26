/*
 *
 * Comments
 *
 */

import { type FC, useEffect } from 'react'

import { ANCHOR } from '~/const/dom'
// import NoticeBar from '~/widgets/NoticeBar'

import { API_MODE } from './constant'
import Editor from './Editor'
// import LockedMessage from './LockedMessage'
import HeadBar from './HeadBar'
import List from './List'
import useSalon from './salon'
import type { TAPIMode } from './spec'
import { useCommentsEditState, useCommentsRootState } from './useLogic'
import useActions from './useLogic/useActions'

type TProps = {
  apiMode?: TAPIMode
  locked?: boolean
}

const Comments: FC<TProps> = ({ locked: _locked = false, apiMode = API_MODE.ARTICLE }) => {
  const s = useSalon()
  const { initialized, totalCount } = useCommentsRootState()
  const editState = useCommentsEditState()
  const { loadComments } = useActions()

  useEffect(() => {
    if (!initialized) {
      loadComments()
    }
  }, [])

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
