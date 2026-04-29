import type { TEditFunc, TPostLayout } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import { FIELD } from '../constant'
import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  layout: TPostLayout
  isTouched: boolean
  saving: boolean
}

export default function usePost(): TRet {
  const dsb$ = useDashboard()
  const { isChanged, edit } = useHelper()

  const { postLayout, saving } = dsb$

  const isTouched = isChanged(FIELD.POST_LAYOUT)

  return {
    edit,
    layout: postLayout,
    saving,
    isTouched,
  }
}
