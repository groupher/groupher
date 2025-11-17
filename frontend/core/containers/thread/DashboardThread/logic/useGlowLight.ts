import useSubStore from '~/hooks/useSubStore'
import type { TEditFunc } from '~/spec'

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

export default (): TRet => {
  const store = useSubStore('dashboard')
  const { edit, isChanged } = useHelper()

  const { glowType, glowFixed, glowOpacity, saving } = store

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
