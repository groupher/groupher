import { pick } from 'ramda'

import type { TEditFunc } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import { FIELD } from '../constant'
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

  const isTouched = isChanged(FIELD.GAUSS_BLUR)
  const isDarkTouched = isChanged(FIELD.GAUSS_BLUR_DARK)

  return {
    edit,
    ...pick(['gaussBlur', 'gaussBlurDark', 'saving'], dsb$),
    isTouched,
    isDarkTouched,
  }
}
