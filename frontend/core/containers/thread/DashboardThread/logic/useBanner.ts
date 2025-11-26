import useDashboard from '~/hooks/useDashboard'
import type { TBannerLayout, TEditFunc } from '~/spec'

import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  layout: TBannerLayout
  isTouched: boolean
  saving: boolean
}

export default (): TRet => {
  const store = useDashboard()
  const { isChanged, edit } = useHelper()

  const { bannerLayout, saving } = store

  const isTouched = isChanged('bannerLayout')

  return {
    edit,
    layout: bannerLayout,
    isTouched,
    saving,
  }
}
