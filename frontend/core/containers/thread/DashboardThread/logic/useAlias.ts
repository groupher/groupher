import { FIELD } from '~/containers/thread/DashboardThread/constant'
import useDashboard from '~/hooks/useDashboard'
import type { TDsbAliasRoute, TEditFunc, TNameAlias } from '~/spec'

import useHelper from './useHelper'

type TRet = {
  saving: boolean
  nameAlias: readonly TNameAlias[]
  editingAlias: TNameAlias
  aliasTab: TDsbAliasRoute

  updateEditingAlias: (alias: TNameAlias) => void
  edit: TEditFunc
  resetEdit: () => void
}

export default (): TRet => {
  const dsb$ = useDashboard()
  const { edit, resetEdit } = useHelper()

  const { aliasTab, editingAlias, nameAlias, saving } = dsb$

  const updateEditingAlias = (alias: TNameAlias): void => {
    dsb$.commit({ editingAlias: alias })
  }

  return {
    aliasTab,
    editingAlias,
    nameAlias,
    saving,
    edit,
    updateEditingAlias,
    resetEdit: () => resetEdit(FIELD.NAME_ALIAS),
  }
}
