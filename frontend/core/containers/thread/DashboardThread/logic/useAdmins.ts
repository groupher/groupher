import { useCallback } from 'react'

import type { TModerator, TUser } from '~/spec'

import { sortByKey } from '~/helper'
import useDashboard from '~/hooks/useDashboard'

type TRet = {
  getModerators: () => TModerator[]
  activeModerator: TUser | null
  setActiveSettingAdmin: (user: TUser) => void
}

export default (): TRet => {
  const store = useDashboard()

  const { moderators, activeModerator } = store

  // drived
  const getModerators = useCallback(() => {
    return sortByKey(moderators, 'passportItemCount').reverse() as TModerator[]
  }, [store])

  const setActiveSettingAdmin = (user: TUser): void => store.commit({ activeModerator: user })

  return {
    getModerators,
    activeModerator,
    setActiveSettingAdmin,
  }
}
