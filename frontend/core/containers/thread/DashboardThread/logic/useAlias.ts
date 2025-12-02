import useSubState from '~/hooks/useSubStore'
import type { TDsbAliasRoute, TEditFunc, TNameAlias } from '~/spec'
import { FIELD } from '~/stores/dashboard/constant'

import useHelper from './useHelper'

type TRet = {
  saving: boolean
  nameAlias: TNameAlias[]
  editingAlias: TNameAlias
  aliasTab: TDsbAliasRoute

  updateEditingAlias: (alias: TNameAlias) => void
  edit: TEditFunc
  resetEdit: () => void
  changeTab: (tab: TDsbAliasRoute) => void
}

export default (): TRet => {
  const store = useSubState('dashboard')
  const { edit, resetEdit } = useHelper()

  const { aliasTab, editingAlias, nameAlias, saving } = store

  const updateEditingAlias = (alias: TNameAlias): void => {
    store.commit({ editingAlias: alias })
  }

  const changeTab = (tab: TDsbAliasRoute) => {
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
