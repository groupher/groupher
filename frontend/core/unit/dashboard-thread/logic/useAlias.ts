import type { TEditFunc, TNameAlias } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'
import { FIELD } from '../constant'

import useHelper from './useHelper'

type TRet = {
  saving: boolean
  nameAlias: readonly TNameAlias[]
  editingAlias: TNameAlias

  updateEditingAlias: (alias: TNameAlias) => void
  edit: TEditFunc
  resetEdit: () => void
}

export default function useAlias(): TRet {
  const dsb$ = useDashboard()
  const { edit, resetEdit } = useHelper()

  const { editingAlias, nameAlias, saving } = dsb$

  const updateEditingAlias = (alias: TNameAlias): void => {
    dsb$.commit({ editingAlias: alias })
  }

  return {
    editingAlias,
    nameAlias,
    saving,
    edit,
    updateEditingAlias,
    resetEdit: () => resetEdit(FIELD.NAME_ALIAS),
  }
}
