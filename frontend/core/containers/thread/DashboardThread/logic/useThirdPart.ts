import useDashboard from '~/hooks/useDashboard'
import type { TDsbThirdPartRoute, TEditFunc } from '~/spec'

import useHelper from './useHelper'

type TRet = {
  saving: boolean
  thirdPartTab: TDsbThirdPartRoute

  edit: TEditFunc
}

export default (): TRet => {
  const dsb$ = useDashboard()
  const { edit } = useHelper()

  const { thirdPartTab, saving } = dsb$

  return {
    thirdPartTab,
    saving,
    edit,
  }
}
