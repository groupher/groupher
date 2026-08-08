import { type FC, Fragment } from 'react'

import Modal from '~/ui/Modal'

import type { TEditState } from '../spec'
import useActions from '../useLogic/useActions'
import ReplyEditor from './ReplyEditor'
import UpdateEditor from './UpdateEditor'

type TProps = {
  editState: TEditState
}

const CommentEditor: FC<TProps> = ({ editState }) => {
  const { closeUpdateEditor, onReplyEditorClose } = useActions()

  const {
    // update
    showUpdateEditor,
    updateInnerId,
    updateBody,
    // reply
    showReplyEditor,
    replyToComment,
    replyBody,
    submitState,
  } = editState

  return (
    <Fragment>
      <Modal show={showUpdateEditor} width='680px' onClose={closeUpdateEditor} showCloseBtn>
        {showUpdateEditor && (
          <UpdateEditor innerId={updateInnerId} body={updateBody} submitState={submitState} />
        )}
      </Modal>

      <Modal show={showReplyEditor} width='680px' onClose={onReplyEditorClose} showCloseBtn>
        {showReplyEditor && (
          <ReplyEditor replyToComment={replyToComment} body={replyBody} submitState={submitState} />
        )}
      </Modal>
    </Fragment>
  )
}

export default CommentEditor
