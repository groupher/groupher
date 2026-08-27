import type { TEditFunc } from '~/spec'
import useDsb from '~/stores/dsb/hooks'

import { FIELD } from '../constant'
import useHelper from './useHelper'

type TRet = {
  overlayDark: boolean
  saving: boolean
  isTouched: boolean
  edit: TEditFunc
}

/** Exposes overlay dark state and actions through the shared React hook boundary. */
export default function useOverlayDark(): TRet {
  const dsb$ = useDsb()
  const { edit, isChanged } = useHelper()

  const { overlayDark, saving } = dsb$

  return {
    overlayDark,
    saving,
    edit,
    isTouched: isChanged(FIELD.OVERLAY_DARK),
  }
}
