import type { TEditFunc } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

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

  const isTouched = isChanged('glowType')
  const isGrowFixedTouched = isChanged('glowFixed')
  const isGrowOpacityTouched = isChanged('glowOpacity')

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
