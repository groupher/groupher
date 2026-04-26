/*
 *
 * AccountUnit
 *
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { FC } from 'react'

import { ROUTE } from '~/const/route'
import useTrans from '~/hooks/useTrans'
import AddSVG from '~/icons/Add'
import CmdSVG from '~/icons/Cmd'
import LogoutSVG from '~/icons/Logout'
import SettingSVG from '~/icons/Setting'
import Img from '~/Img'
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
  const { t } = useTrans()
  const router = useRouter()

  const { avatar, nickname } = user

  return (
    <Tooltip
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
          <div className={s.divider} />
          <div className={s.menuBar}>
            <div className={s.menuTitle}>{t('account.menu.guide')}</div>
          </div>
          <div className={s.menuBar}>
            <div className={s.menuTitle}>{t('account.menu.shortcuts')}</div>
            <CmdSVG className={s.icon} />
          </div>
          {/* <MenuBar>主题?</MenuBar> */}
          <Link href={ROUTE.APPLY_COMMUNITY} prefetch={false} className={s.linkable}>
            <div className={s.menuBar}>
              <div className={s.menuTitle}>{t('account.menu.create_community')}</div>
              <AddSVG className={s.icon} />
            </div>
          </Link>
          <div className={s.divider} />
          <button
            type='button'
            className={cn(s.menuBar, s.warningActive)}
            onClick={() => signOut(() => router.refresh())}
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
      <Img src={avatar} fallback={<ImgFallback user={user} />} className={s.avatar} clickable />
    </Tooltip>
  )
}

export default LoggedInAccount
