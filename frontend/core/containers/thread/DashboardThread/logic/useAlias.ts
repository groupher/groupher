import useSubState from '~/hooks/useSubStore'
import type { TDashboardAliasRoute, TEditFunc, TNameAlias } from '~/spec'
import { FIELD } from '~/stores/dashboard/constant'

import useHelper from './useHelper'

type TRet = {
  saving: boolean
  nameAlias: TNameAlias[]
  editingAlias: TNameAlias
  aliasTab: TDashboardAliasRoute

  updateEditingAlias: (alias: TNameAlias) => void
  edit: TEditFunc
  resetEdit: () => void
  changeTab: (tab: TDashboardAliasRoute) => void
}

export default (): TRet => {
  const store = useSubState('dashboard')
  const { edit, resetEdit } = useHelper()

  const { aliasTab, editingAlias, nameAlias, saving } = store

  const updateEditingAlias = (alias: TNameAlias): void => {
    store.commit({ editingAlias: alias })
  }

  const changeTab = (tab: TDashboardAliasRoute) => {
    store.commit({ aliasTab: tab })
  }

  return {
    aliasTab,
    editingAlias,
    nameAlias,
    saving,
    changeTab,
    edit,
    updateEditingAlias,
    resetEdit: () => resetEdit(FIELD.NAME_ALIAS),
  }
}
