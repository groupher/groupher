/*
 *
 * AccountUnit
 *
 */

import { useRouter } from '@tanstack/react-router'
import { type FC, useState } from 'react'

import { ROUTE } from '~/const/route'
import useTrans from '~/hooks/useTrans'
import AddSVG from '~/icons/Add'
import CmdSVG from '~/icons/Cmd'
import DesktopSVG from '~/icons/Desktop'
import LogoutSVG from '~/icons/Logout'
import SettingSVG from '~/icons/Setting'
import Img from '~/Img'
import { signOut } from '~/oauth'
import { Link } from '~/platform'
import type { TSpace, TUser } from '~/spec'
import ImgFallback from '~/ui/ImgFallback'
import Tooltip from '~/ui/Tooltip'
import AccountSessionDrawer from '~/unit/AccountSessionDrawer'

import useSalon, { cn } from './salon/logged_in_account'

type TProps = {
  withName?: boolean
  user: TUser
} & TSpace

const LoggedInAccount: FC<TProps> = ({ user }) => {
  const s = useSalon()
  const { t } = useTrans()
  const router = useRouter()
  const [showSessions, setShowSessions] = useState(false)

  const { avatar, nickname } = user

  return (
    <>
      <AccountSessionDrawer show={showSessions} onClose={() => setShowSessions(false)} />
      <Tooltip
        accessibleContent
        offset={[18, 5]}
        content={
          <div className={s.panel}>
            <div className={s.baseInfo}>
              <div className={s.userName}>{nickname}</div>
              <div className={s.loginBy}>{t('account.menu.via_github')}</div>
            </div>
            <div className={s.menuBar}>
              <div className={s.menuTitle}>{t('account.menu.settings')}</div>
              <SettingSVG className={s.icon} />
            </div>
            <div className={s.menuBar}>
              <div className={s.menuTitle}>{t('account.menu.profile')}</div>
            </div>
            <button
              type='button'
              aria-label='Login & devices'
              className={s.menuBar}
              onClick={() => setShowSessions(true)}
            >
              <span className={s.menuTitle}>Login &amp; devices</span>
              <DesktopSVG className={s.icon} />
            </button>
            <div className={s.divider} />
            <div className={s.menuBar}>
              <div className={s.menuTitle}>{t('account.menu.guide')}</div>
            </div>
            <div className={s.menuBar}>
              <div className={s.menuTitle}>{t('account.menu.shortcuts')}</div>
              <CmdSVG className={s.icon} />
            </div>
            {/* <MenuBar>主题?</MenuBar> */}
            <Link href={ROUTE.APPLY} navigation='document' className={s.linkable}>
              <div className={s.menuBar}>
                <div className={s.menuTitle}>{t('account.menu.create_community')}</div>
                <AddSVG className={s.icon} />
              </div>
            </Link>
            <div className={s.divider} />
            <button
              type='button'
              aria-label='Log out'
              className={cn(s.menuBar, s.warningActive)}
              onClick={() => signOut(() => void router.invalidate())}
            >
              <span className={s.menuTitle}>{t('account.menu.logout')}</span>
              <LogoutSVG className={s.logoutIcon} />
            </button>
          </div>
        }
        placement='bottom-end'
        trigger='click'
        noPadding
      >
        <Img
          src={avatar}
          alt='Open account menu'
          fallback={<ImgFallback user={user} />}
          className={s.avatar}
          clickable
        />
      </Tooltip>
    </>
  )
}

export default LoggedInAccount
