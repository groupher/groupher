import { pick } from 'ramda'
import useDashboard from '~/hooks/useDashboard'

import type { TDashboardLayoutRoute, TDashboardPath, TEditFunc } from '~/spec'

import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  layoutTab: TDashboardLayoutRoute
  curTab: TDashboardPath
}

export default (): TRet => {
  const { edit } = useHelper()
  const store = useDashboard()

  return {
    edit,
    ...pick(['curTab', 'layoutTab'], store),
  }
}
