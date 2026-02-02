/*
 *
 * AccountUnit
 *
 */

import Link from 'next/link'
import type { FC } from 'react'
import { ROUTE } from '~/const/route'
import Img from '~/Img'
import AddSVG from '~/icons/Add'
import CmdSVG from '~/icons/Cmd'
import LogoutSVG from '~/icons/Logout'
import SettingSVG from '~/icons/Setting'
import { signOut } from '~/oauth'
import type { TSpace, TUser } from '~/spec'
import ImgFallback from '~/widgets/ImgFallback'
import Tooltip from '~/widgets/Tooltip'

import useSalon, { cn } from './salon/logged_in_account'

type TProps = {
  withName?: boolean
  user: TUser
} & TSpace

const LoggedInAccount: FC<TProps> = ({ user }) => {
  const s = useSalon()

  const { avatar, nickname } = user

  return (
    <Tooltip
      offset={[18, 5]}
      content={
        <div className={s.panel}>
          <div className={s.baseInfo}>
            <div className={s.userName}>{nickname}</div>
            <div className={s.loginBy}>via Github</div>
          </div>
          <div className={s.menuBar}>
            <div className={s.menuTitle}>账户设置</div>
            <SettingSVG className={s.icon} />
          </div>
          <div className={s.menuBar}>
            <div className={s.menuTitle}>个人主页</div>
          </div>
          <div className={s.divider} />
          <div className={s.menuBar}>
            <div className={s.menuTitle}>使用指南</div>
          </div>
          <div className={s.menuBar}>
            <div className={s.menuTitle}>快捷键</div>
            <CmdSVG className={s.icon} />
          </div>
          {/* <MenuBar>主题?</MenuBar> */}
          <Link href={ROUTE.APPLY_COMMUNITY} prefetch={false} className={s.linkable}>
            <div className={s.menuBar}>
              <div className={s.menuTitle}>创建社区</div>
              <AddSVG className={s.icon} />
            </div>
          </Link>
          <div className={s.divider} />
          <button className={cn(s.menuBar, s.warningActive)} onClick={() => signOut()}>
            <span className={s.menuTitle}>登出</span>
            <LogoutSVG className={s.logoutIcon} />
          </button>
        </div>
      }
      placement='bottom-end'
      trigger='click'
      noPadding
    >
      <Img src={avatar} fallback={<ImgFallback user={user} />} className={s.avatar} clickable />
    </Tooltip>
  )
}

export default LoggedInAccount
