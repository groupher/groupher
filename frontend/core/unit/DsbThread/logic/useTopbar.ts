import type { TColorName, TEditFunc } from '~/spec'
import useDsbShell from '~/stores/dsbShell/hooks'

import { FIELD } from '../constant'
import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  enabled: boolean
  isLayoutTouched: boolean
  isBgTouched: boolean
  saving: boolean
  bg: TColorName
}

/** Exposes topbar state and actions through the shared React hook boundary. */
export default function useTopbar(): TRet {
  const dsb$ = useDsbShell()
  const { isChanged, edit, isPending } = useHelper()

  const { topbarEnabled, topbarBg } = dsb$

  const isLayoutTouched = isChanged(FIELD.TOPBAR_ENABLED)
  const isBgTouched = isChanged(FIELD.TOPBAR_BG)

  return {
    edit,
    enabled: topbarEnabled,
    isLayoutTouched,
    isBgTouched,
    bg: topbarBg,
    saving: isPending,
  }
}
