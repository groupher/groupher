import type { FC } from 'react'

import type { TModerator } from '~/spec'
import { mockUsers } from '~/mock'

import Img from '~/Img'
import ImgFallback from '~/widgets/ImgFallback'
import NoteTip from '~/widgets/NoteTip'

import AdminMember from './AdminMember'

import useSalon, { cn } from '../salon/members'

type TProps = {
  moderators: TModerator[]
}

const Members: FC<TProps> = ({ moderators }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.block}>
        <div className={s.header}>
          <h3 className={s.title}>社区管理员</h3>
        </div>
        <div className={s.adminsRow}>
          {moderators.map((moderator: TModerator) => (
            <div key={moderator.user.login} className={s.admin}>
              <AdminMember user={moderator.user} />
            </div>
          ))}
        </div>
      </div>

      <div className={s.divider} />

      <div className={s.block}>
        <div className={s.header}>
          <h3 className={s.title}>
            参与互动
            <NoteTip fontSize={14} left={4} placement="right" offset={[-6, 10]}>
              参与发布，投票，评论，以及 Emoji 反馈的用户
            </NoteTip>
          </h3>
        </div>
        <div className={cn(s.adminsRow, 'gap-3')}>
          {mockUsers(15).map((user) => (
            <Img
              className={s.joinerAavtar}
              key={user.login}
              src={user.avatar}
              fallback={<ImgFallback size={7} user={user} />}
            />
          ))}
          {mockUsers(15).map((user) => (
            <Img
              className={s.joinerAavtar}
              key={user.login}
              src={user.avatar}
              fallback={<ImgFallback size={7} user={user} />}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default Members
