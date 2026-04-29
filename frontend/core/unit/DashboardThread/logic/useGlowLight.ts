import type { TEditFunc } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import { FIELD } from '../constant'
import useHelper from './useHelper'

type TRet = {
  glowType: string
  glowFixed: boolean
  glowOpacity: string
  isTouched: boolean
  isGrowFixedTouched: boolean
  isGrowOpacityTouched: boolean
  saving: boolean
  edit: TEditFunc
}

export default function useGlowLight(): TRet {
  const dsb$ = useDashboard()
  const { edit, isChanged } = useHelper()

  const { glowType, glowFixed, glowOpacity, saving } = dsb$

  const isTouched = isChanged(FIELD.GLOW_TYPE)
  const isGrowFixedTouched = isChanged(FIELD.GLOW_FIXED)
  const isGrowOpacityTouched = isChanged(FIELD.GLOW_OPACITY)

  return {
    edit,
    glowType,
    glowFixed,
    glowOpacity,
    saving,
    isTouched,
    isGrowFixedTouched,
    isGrowOpacityTouched,
  }
}
