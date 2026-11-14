import type { TEditFunc, TNameAlias } from '~/spec'
import { useAliasEditor } from '~/stores/dsbShell/editor'
import useDsbShell from '~/stores/dsbShell/hooks'

import { FIELD } from '../constant'
import useHelper from './useHelper'

type TRet = {
  saving: boolean
  nameAlias: readonly TNameAlias[]
  editingAlias: TNameAlias | null

  updateEditingAlias: (alias: TNameAlias) => void
  edit: TEditFunc
  resetEdit: () => void
}

/** Exposes alias state and actions through the shared React hook boundary. */
export default function useAlias(): TRet {
  const dsb$ = useDsbShell()
  const aliasEditor = useAliasEditor()
  const { edit, resetEdit, isPending } = useHelper()

  const { editingAlias } = aliasEditor
  const { nameAlias } = dsb$

  const updateEditingAlias = (alias: TNameAlias): void => {
    aliasEditor.setEditingAlias(alias)
  }

  return {
    editingAlias,
    nameAlias,
    saving: isPending,
    edit,
    updateEditingAlias,
    resetEdit: () => resetEdit(FIELD.NAME_ALIAS),
  }
}
