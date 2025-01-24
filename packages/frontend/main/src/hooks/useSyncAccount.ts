import { useEffect, useState } from 'react'

import type { TAccount, TSimpleUser } from '~/spec'
import OAUTH from '~/const/oauth'
import useSubStore from '~/hooks/useSubStore'
import { debounce } from '~/helper'
import BStore from '~/utils/bstore'

export default (): TAccount => {
  const { isLogin, setSession, accountInfo } = useSubStore('account')

  const [isLinkClickListenerAdded, setIsLinkClickListenerAdded] = useState(false)

  /**
   * TODO: handle token expired situation
   */
  const syncAccountInfo = debounce(() => {
    const user = BStore.cookie.get(OAUTH.USER_KEY)
    const token = BStore.cookie.get(OAUTH.TOKEN_KEY)

    if (user) {
      const parsedUser = JSON.parse(user) as TSimpleUser

      if (!isLogin && parsedUser.login) {
        setSession(parsedUser, token)
      }
    }
  }, 200)

  /**
   * this is ugly workaround for syncing account info when user click on Link
   * cuz in next 13+, the route listen events is removed
   */
  const handleLinkClick = (event) => {
    // 检查事件的目标是否为<a>标签
    if (event.target.tagName === 'A') {
      // 切换 theme 以后，可能会导致一个时间差使得切换无效，母鸡为何 ..
      setTimeout(() => {
        syncAccountInfo()
      }, 20)
    }
  }

  useEffect(() => {
    syncAccountInfo()
  }, [isLogin])

  useEffect(() => {
    if (!isLinkClickListenerAdded) {
      document.addEventListener('click', handleLinkClick)
      setIsLinkClickListenerAdded(true)
    }
    return () => {
      document.removeEventListener('click', handleLinkClick)
      setIsLinkClickListenerAdded(false)
    }
  }, [])

  return accountInfo
}
