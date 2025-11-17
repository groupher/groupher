import { pick } from 'ramda'
import useSubStore from '~/hooks/useSubStore'
import type { TEditFunc } from '~/spec'

import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  gossBlur: number
  gossBlurDark: number
  saving: boolean
  isTouched: boolean
  isDarkTouched: boolean
}

export default (): TRet => {
  const store = useSubStore('dashboard')
  const { isChanged, edit } = useHelper()

  const isTouched = isChanged('gossBlur')
  const isDarkTouched = isChanged('gossBlurDark')

  return {
    edit,
    ...pick(['gossBlur', 'gossBlurDark', 'saving'], store),
    isTouched,
    isDarkTouched,
  }
}
