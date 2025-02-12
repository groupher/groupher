import type { FC } from 'react'

import type { TAccount } from '~/spec'

import Img from '~/Img'
import CommentSVG from '~/icons/Comment'
import UserSVG from '~/icons/User'

import useLogic from '../useLogic'
import useSalon from '../salon/editor/header'

type TProps = {
  accountInfo: TAccount
  showEditor: boolean
}

const EditorHeader: FC<TProps> = ({ accountInfo, showEditor }) => {
  const s = useSalon()

  const { openEditor } = useLogic()

  if (showEditor) {
    return (
      <div className={s.expandWrapper}>
        <div className={s.hintText}>创建评论:</div>
        <Img className={s.avatar} src={accountInfo.avatar} />
        <div className={s.leaveResUsername}>{accountInfo.nickname}</div>
      </div>
    )
  }
  return (
    <div className={s.wrapper} onClick={openEditor}>
      {accountInfo.avatar ? (
        <Img src={accountInfo.avatar} className={s.avatar} />
      ) : (
        <UserSVG className={s.unLogUserIcon} />
      )}
      <div className={s.leaveRes}>欢迎参与进来一起讨论 ~</div>
      <div className="grow" />
      <CommentSVG className={s.commentIcon} />
    </div>
  )
}

export default EditorHeader
