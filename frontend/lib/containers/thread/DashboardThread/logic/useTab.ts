import { pick } from 'ramda'

import type { TDashboardLayoutRoute, TDashboardPath, TEditFunc } from '~/spec'

import useSubStore from '~/hooks/useSubStore'

import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  layoutTab: TDashboardLayoutRoute
  curTab: TDashboardPath
}

export default (): TRet => {
  const { edit } = useHelper()
  const store = useSubStore('dashboard')

  return {
    edit,
    ...pick(['curTab', 'layoutTab'], store),
  }
}
