import { pick } from 'ramda'
import useDashboard from '~/hooks/useDashboard'

import type { TDsbLayoutRoute, TDsbPath, TEditFunc } from '~/spec'

import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  layoutTab: TDsbLayoutRoute
  menuTab: TDsbPath
}

export default (): TRet => {
  const { edit } = useHelper()
  const dsb$ = useDashboard()

  return {
    edit,
    ...pick(['menuTab', 'layoutTab'], dsb$),
  }
}
