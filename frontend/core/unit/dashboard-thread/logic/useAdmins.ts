import { useMemo } from 'react'
import { sortByKey } from '~/helper'
import useDashboard from '~/stores/dashboard/hooks'
import type { TModerator, TUser } from '~/spec'

type TRet = {
  moderators: TModerator[]
  activeModerator: TUser | null
  setActiveSettingAdmin: (user: TUser) => void
}

export default function useAdmins(): TRet {
  const dsb$ = useDashboard()
  const { moderators: originalModerators, activeModerator } = dsb$

  const moderators = useMemo(() => {
    return sortByKey(originalModerators, 'passportItemCount').reverse() as TModerator[]
  }, [originalModerators])

  const setActiveSettingAdmin = (user: TUser): void => dsb$.commit({ activeModerator: user })

  return {
    moderators,
    activeModerator,
    setActiveSettingAdmin,
  }
}
