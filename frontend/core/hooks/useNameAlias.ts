import { filter } from 'ramda'
import { useMemo } from 'react'
import useDashboard from '~/hooks/useDashboard'
import type { TNameAlias } from '~/spec'

const useNameAlias = (group = 'kanban'): Record<string, TNameAlias> => {
  const store = useDashboard()

  const alias = {}
  let aliasList = []

  const curAlias = useMemo(() => store.nameAlias, [store.nameAlias])

  if (!group) {
    aliasList = [...curAlias]
  } else {
    aliasList = filter((item: TNameAlias) => item.group === group, [...curAlias])
  }

  for (const item of aliasList) {
    alias[item.slug] = item
  }

  return alias
}

export default useNameAlias
