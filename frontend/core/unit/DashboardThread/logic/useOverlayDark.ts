import type { TEditFunc } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import { FIELD } from '../constant'
import useHelper from './useHelper'

type TRet = {
  overlayDark: boolean
  saving: boolean
  isTouched: boolean
  edit: TEditFunc
}

export default function useOverlayDark(): TRet {
  const dsb$ = useDashboard()
  const { edit, isChanged } = useHelper()

  const { overlayDark, saving } = dsb$

  return {
    overlayDark,
    saving,
    edit,
    isTouched: isChanged(FIELD.OVERLAY_DARK),
  }
}
