import useDashboard from '~/hooks/useDashboard'
import type { TDsbAliasRoute, TEditFunc, TNameAlias } from '~/spec'
import { FIELD } from '~/stores/dashboard/constant'

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
  const store = useDashboard()
  const { edit, resetEdit } = useHelper()

  const { aliasTab, editingAlias, nameAlias, saving } = store

  const updateEditingAlias = (alias: TNameAlias): void => {
    store.commit({ editingAlias: alias })
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
