import { useMemo } from 'react'
import { sortByKey } from '~/helper'
import useDashboard from '~/hooks/useDashboard'
import type { TModerator, TUser } from '~/spec'

type TRet = {
  moderators: TModerator[]
  activeModerator: TUser | null
  setActiveSettingAdmin: (user: TUser) => void
}

export default (): TRet => {
  const store = useDashboard()
  const { moderators: originalModerators, activeModerator } = store

  const moderators = useMemo(() => {
    return sortByKey(originalModerators, 'passportItemCount').reverse() as TModerator[]
  }, [originalModerators])

  const setActiveSettingAdmin = (user: TUser): void => store.commit({ activeModerator: user })

  return {
    moderators,
    activeModerator,
    setActiveSettingAdmin,
  }
}
