/*
 *
 * AccountUnit
 *
 */

import { type FC, useState } from 'react'
import { BANNER_LAYOUT } from '~/const/layout'
import useAccount from '~/stores/account/hooks'
import useLayout from '~/hooks/useLayout'
import AccountSVG from '~/icons/Account'
import type { TSpace } from '~/spec'

import LoggedInAccount from './LoggedInAccount'
import Panel from './Panel'

import useSalon from './salon'

type TProps = {
  withName?: boolean
} & TSpace

const AccountUnit: FC<TProps> = ({ withName = false, ...spacing }) => {
  const s = useSalon({ ...spacing })

  const { isLogin, user, loading } = useAccount()
  const { bannerLayout } = useLayout()

  const [showPanel, setShowPanel] = useState(false)

  if (loading) {
    return (
      <div className={s.wrapper}>
        <div className={s.loadingBox} />
      </div>
    )
  }

  return (
    <div className={s.wrapper}>
      {isLogin ? (
        <div className={s.hoverBox}>
          <LoggedInAccount user={user} />
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
