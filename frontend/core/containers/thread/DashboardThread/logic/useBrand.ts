import useSubStore from '~/hooks/useSubStore'
import type { TBrandLayout, TEditFunc } from '~/spec'

import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  layout: TBrandLayout
  isTouched: boolean
  saving: boolean
}

export default (): TRet => {
  const store = useSubStore('dashboard')
  const { isChanged, edit } = useHelper()

  const { brandLayout, saving } = store

  const isTouched = isChanged('brandLayout')

  return {
    edit,
    layout: brandLayout,
    saving,
    isTouched,
  }
}
