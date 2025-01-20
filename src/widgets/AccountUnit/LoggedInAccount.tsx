/*
 *
 * AccountUnit
 *
 */

import type { FC } from 'react'

import type { TSpace } from '~/spec'
import useAccount from '~/hooks/useAccount'

import { ROUTE } from '~/const/route'
import { signOut } from '~/oauth'

import Img from '~/Img'
import SettingSVG from '~/icons/Setting'
import AddSVG from '~/icons/Add'
import LogoutSVG from '~/icons/Logout'
import CmdSVG from '~/icons/Cmd'
import { LinkAble } from '~/widgets/Common'
import Tooltip from '~/widgets/Tooltip'
import ImgFallback from '~/widgets/ImgFallback'

import useSalon, { cn } from './salon/logged_in_account'

type TProps = {
  withName?: boolean
} & TSpace

const LoggedInAccount: FC<TProps> = () => {
  const s = useSalon()

  const user = useAccount()
  const { avatar } = user

  return (
    <Tooltip
      content={
        <div className={s.panel}>
          <div className={s.baseInfo}>
            <div className={s.userName}>{user.nickname}</div>
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
          <LinkAble href={ROUTE.APPLY_COMMUNITY} prefetch={false}>
            <div className={s.menuBar}>
              <div className={s.menuTitle}>创建社区</div>
              <AddSVG className={s.icon} />
            </div>
          </LinkAble>
          <div className={s.divider} />
          <div className={cn(s.menuBar, s.warningActive)} onClick={() => signOut()}>
            <div className={s.menuTitle}>登出</div>
            <LogoutSVG className={s.logoutIcon} />
          </div>
        </div>
      }
      placement="bottom-end"
      trigger="click"
      noPadding
    >
      <Img src={avatar} fallback={<ImgFallback size={5} user={user} />} className={s.avatar} />
    </Tooltip>
  )
}

export default LoggedInAccount
