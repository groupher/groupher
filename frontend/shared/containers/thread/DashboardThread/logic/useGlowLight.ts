import { useCallback } from 'react'

import type { TEditFunc } from '~/spec'
import useSubStore from '~/hooks/useSubStore'

import useHelper from './useHelper'

type TRet = {
  glowType: string
  glowFixed: boolean
  glowOpacity: string
  getIsTouched: () => boolean
  getIsGrowFixedTouched: () => boolean
  getIsGrowOpacityTouched: () => boolean
  saving: boolean
  edit: TEditFunc
}

export default (): TRet => {
  const store = useSubStore('dashboard')
  const { edit, isChanged } = useHelper()

  const { glowType, glowFixed, glowOpacity, saving } = store

  const getIsTouched = useCallback(() => isChanged('glowType'), [store])
  const getIsGrowFixedTouched = useCallback(() => isChanged('glowFixed'), [store])
  const getIsGrowOpacityTouched = useCallback(() => isChanged('glowOpacity'), [store])

  return {
    edit,
    glowType,
    glowFixed,
    glowOpacity,
    saving,
    getIsTouched,
    getIsGrowFixedTouched,
    getIsGrowOpacityTouched,
  }
}
