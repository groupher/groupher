/*
 *
 * AccountUnit
 *
 */

import type { FC } from 'react'

import { requestLogin } from '~/auth'
import { COMMUNITY_LAYOUT } from '~/const/layout'
import useLayout from '~/hooks/useLayout'
import AccountSVG from '~/icons/Account'
import type { TSpace } from '~/spec'
import useAccount from '~/stores/account/hooks'

import LoggedInAccount from './LoggedInAccount'
import useSalon from './salon'

type TProps = {
  withName?: boolean
} & TSpace

const AccountUnit: FC<TProps> = ({ withName = false, ...spacing }) => {
  const s = useSalon({ ...spacing })

  const { isLogin, user, loading } = useAccount()
  const { communityLayout } = useLayout()

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
        <button
          type='button'
          aria-label='Sign in'
          className={s.hoverBox}
          onClick={() => requestLogin()}
        >
          <AccountSVG className={s.unLoginIcon} />
        </button>
      )}
      {!isLogin && withName && <div className={s.nickname}>未登入</div>}
      {isLogin && withName && <div className={s.nickname}>{user?.nickname}</div>}
      {communityLayout === COMMUNITY_LAYOUT.SIDEBAR && <div className='grow' />}
    </div>
  )
}

export default AccountUnit
