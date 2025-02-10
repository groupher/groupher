import { useMemo } from 'react'
import { filter } from 'ramda'

import type { TNameAlias } from '~/spec'

import useSubStore from '~/hooks/useSubStore'
import useViewingCommunity from '~/hooks/useViewingCommunity'

const useNameAlias = (group = 'kanban'): Record<string, TNameAlias> => {
  const store = useSubStore('dashboard')
  const community = useViewingCommunity()

  const alias = {}
  let aliasList = []

  const curAlias = useMemo(() => store.nameAlias, [community])

  // console.log('## cacle name alias, FIXME')

  if (!group) {
    aliasList = curAlias
  } else {
    aliasList = filter((item: TNameAlias) => item.group === group, curAlias)
  }

  for (const item of aliasList) {
    alias[item.slug] = item
  }

  return alias
}

export default useNameAlias
