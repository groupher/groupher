/*
 *
 * AccountUnit
 *
 */

import { type FC, useState } from 'react'
import { BANNER_LAYOUT } from '~/const/layout'
import useAccount from '~/hooks/useAccount'
import useLayout from '~/hooks/useLayout'
import useSyncAccount from '~/hooks/useSyncAccount'
import AccountSVG from '~/icons/Acount'
import type { TSpace } from '~/spec'

import LoggedInAccount from './LoggedInAccount'
import Panel from './Panel'

import useSalon from './salon'

type TProps = {
  withName?: boolean
} & TSpace

const AccountUnit: FC<TProps> = ({ withName = false, ...spacing }) => {
  const s = useSalon({ ...spacing })
  useSyncAccount()

  const { isLogin, user } = useAccount()
  const { bannerLayout } = useLayout()

  const [showPanel, setShowPanel] = useState(false)

  return (
    <div className={s.wrapper}>
      {isLogin ? (
        <div className={s.hoverBox}>
          <LoggedInAccount />
        </div>
      ) : (
        <button className={s.hoverBox} onClick={() => setShowPanel(true)}>
          <AccountSVG className={s.unLoginIcon} />
        </button>
      )}
      {!isLogin && withName && <div className={s.nickname}>未登入</div>}
      {isLogin && withName && <div className={s.nickname}>{user?.nickname}</div>}
      {bannerLayout === BANNER_LAYOUT.SIDEBAR && <div className='grow' />}
      <Panel show={showPanel} onClose={() => setShowPanel(false)} />
    </div>
  )
}

export default AccountUnit
