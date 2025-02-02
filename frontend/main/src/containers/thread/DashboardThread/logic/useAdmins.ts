import { useCallback } from 'react'

import type { TModerator, TUser } from '~/spec'

import { sortByIndex } from '~/helper'
import useSubStore from '~/hooks/useSubStore'

type TRet = {
  getModerators: () => TModerator[]
  activeModerator: TUser | null
  setActiveSettingAdmin: (user: TUser) => void
}

export default (): TRet => {
  const store = useSubStore('dashboard')

  const { moderators, activeModerator } = store

  // drived
  const getModerators = useCallback(() => {
    // @ts-ignore
    return sortByIndex(moderators, 'passportItemCount').reverse() as TModerator[]
  }, [store])

  const setActiveSettingAdmin = (user: TUser): void => store.commit({ activeModerator: user })

  return {
    getModerators,
    activeModerator,
    setActiveSettingAdmin,
  }
}
