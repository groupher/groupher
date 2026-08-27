import type { TColorName, TEditFunc } from '~/spec'
import useDsb from '~/stores/dsb/hooks'

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
  const dsb$ = useDsb()
  const { isChanged, edit } = useHelper()

  const { topbarEnabled, topbarBg, saving } = dsb$

  const isLayoutTouched = isChanged(FIELD.TOPBAR_ENABLED)
  const isBgTouched = isChanged(FIELD.TOPBAR_BG)

  return {
    edit,
    enabled: topbarEnabled,
    isLayoutTouched,
    isBgTouched,
    bg: topbarBg,
    saving,
  }
}
