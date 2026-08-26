import { filter } from 'ramda'
import { useMemo } from 'react'
import { useContext } from 'react'

import type { TNameAlias } from '~/spec'
import { ShellStyleContext } from '~/stores/shellStyle/context'

const useNameAlias = (group = 'kanban'): Record<string, TNameAlias> => {
  const shellStyle = useContext(ShellStyleContext)
  if (!shellStyle) throw new Error('useNameAlias must be used within ShellStyleProvider')

  const alias = {}
  let aliasList = []

  const curAlias = useMemo(() => shellStyle.nameAlias, [shellStyle.nameAlias])

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
