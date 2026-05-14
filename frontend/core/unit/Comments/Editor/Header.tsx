import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import CommentSVG from '~/icons/Comment'
import UserSVG from '~/icons/User'
import Img from '~/Img'
import { createKeyboardClick } from '~/lib/a11y'
import type { TAccount } from '~/spec'

import useSalon from '../salon/editor/header'
import useActions from '../useLogic/useActions'

type TProps = {
  accountInfo: TAccount
  showEditor: boolean
}

const EditorHeader: FC<TProps> = ({ accountInfo, showEditor }) => {
  const s = useSalon()

  const { openEditor } = useActions()
  const { t } = useTrans()

  if (showEditor) {
    return (
      <div className={s.expandWrapper}>
        <div className={s.hintText}>{t('comment.editor.create')}</div>
        <Img className={s.avatar} src={accountInfo.avatar} />
        <div className={s.leaveResUsername}>{accountInfo.nickname}</div>
      </div>
    )
  }
  return (
    <div
      className={s.wrapper}
      role='button'
      tabIndex={0}
      onClick={openEditor}
      onKeyDown={createKeyboardClick(openEditor)}
    >
      {accountInfo.avatar ? (
        <Img src={accountInfo.avatar} className={s.avatar} />
      ) : (
        <UserSVG className={s.unLogUserIcon} />
      )}
      <div className={s.leaveRes}>{t('comment.editor.invite')}</div>
      <div className='grow' />
      <CommentSVG className={s.commentIcon} />
    </div>
  )
}

export default EditorHeader
