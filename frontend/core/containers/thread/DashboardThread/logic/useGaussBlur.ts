import { pick } from 'ramda'
import useDashboard from '~/hooks/useDashboard'
import type { TEditFunc } from '~/spec'

import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  gaussBlur: number
  gaussBlurDark: number
  saving: boolean
  isTouched: boolean
  isDarkTouched: boolean
}

export default function useGaussBlur(): TRet {
  const dsb$ = useDashboard()
  const { isChanged, edit } = useHelper()

  const isTouched = isChanged('gaussBlur')
  const isDarkTouched = isChanged('gaussBlurDark')

  return {
    edit,
    ...pick(['gaussBlur', 'gaussBlurDark', 'saving'], dsb$),
    isTouched,
    isDarkTouched,
  }
}
