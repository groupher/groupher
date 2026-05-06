import type { TCommunityLayout, TEditFunc } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import { FIELD } from '../constant'
import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  layout: TCommunityLayout
  isTouched: boolean
  saving: boolean
}

export default function useCommunityLayout(): TRet {
  const dsb$ = useDashboard()
  const { isChanged, edit: rawEdit, rollbackEdit } = useHelper()

  const { communityLayout, saving } = dsb$

  const isTouched = isChanged(FIELD.COMMUNITY_LAYOUT)
  const isNavActiveLayoutTouched = isChanged(FIELD.NAV_ACTIVE_LAYOUT)

  const edit: TEditFunc = (value, field) => {
    if (field === FIELD.COMMUNITY_LAYOUT && isNavActiveLayoutTouched) {
      rollbackEdit(FIELD.NAV_ACTIVE_LAYOUT)
    }

    rawEdit(value, field)
  }

  return {
    edit,
    layout: communityLayout,
    isTouched,
    saving,
  }
}
