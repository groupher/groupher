import type { TCommunityLayout, TEditFunc } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  layout: TCommunityLayout
  isTouched: boolean
  saving: boolean
}

export default function useCommunityLayout(): TRet {
  const dsb$ = useDashboard()
  const { isChanged, edit } = useHelper()

  const { communityLayout, saving } = dsb$

  const isTouched = isChanged('communityLayout')

  return {
    edit,
    layout: communityLayout,
    isTouched,
    saving,
  }
}
