import type { TBannerLayout, TEditFunc } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  layout: TBannerLayout
  isTouched: boolean
  saving: boolean
}

export default function useBanner(): TRet {
  const dsb$ = useDashboard()
  const { isChanged, edit } = useHelper()

  const { bannerLayout, saving } = dsb$

  const isTouched = isChanged('bannerLayout')

  return {
    edit,
    layout: bannerLayout,
    isTouched,
    saving,
  }
}
