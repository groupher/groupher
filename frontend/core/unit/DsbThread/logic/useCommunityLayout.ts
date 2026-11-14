import type { TCommunityLayout, TEditFunc } from '~/spec'
import useDsbShell from '~/stores/dsbShell/hooks'

import { FIELD } from '../constant'
import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  layout: TCommunityLayout
  isTouched: boolean
  saving: boolean
}

/** Exposes community layout state and actions through the shared React hook boundary. */
export default function useCommunityLayout(): TRet {
  const dsb$ = useDsbShell()
  const { isChanged, edit: rawEdit, rollbackEdit, isPending } = useHelper()

  const { communityLayout } = dsb$

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
    saving: isPending,
  }
}
