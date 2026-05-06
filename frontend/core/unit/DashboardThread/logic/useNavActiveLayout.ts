import { COMMUNITY_LAYOUT } from '~/const/layout'
import type { TCommunityLayout, TEditFunc, TNavActiveLayout } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import { FIELD } from '../constant'
import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  layout: TNavActiveLayout
  communityLayout: TCommunityLayout
  isTouched: boolean
  isSupported: boolean
  saving: boolean
}

export default function useNavActiveLayout(): TRet {
  const dsb$ = useDashboard()
  const { isChanged, edit } = useHelper()

  const { navActiveLayout, communityLayout, saving } = dsb$

  const isTouched = isChanged(FIELD.NAV_ACTIVE_LAYOUT)
  const isSupported =
    communityLayout === COMMUNITY_LAYOUT.CLASSIC || communityLayout === COMMUNITY_LAYOUT.SIDEBAR

  return {
    edit,
    layout: navActiveLayout,
    communityLayout,
    isTouched,
    isSupported,
    saving,
  }
}
