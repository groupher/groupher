import type { TEditFunc, TPostLayout } from '~/spec'
import useDsb from '~/stores/dsb/hooks'

import { FIELD } from '../constant'
import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  layout: TPostLayout
  isTouched: boolean
  saving: boolean
}

/** Exposes post state and actions through the shared React hook boundary. */
export default function usePost(): TRet {
  const dsb$ = useDsb()
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
