'use client'

import { groupByKey } from '~/helper'
import Item from '~/unit/DashboardThread/Alias/Item'
import { ALIAS_GROUP } from '~/unit/DashboardThread/constant'
import useAlias from '~/unit/DashboardThread/hooks/useAlias'

export default function Page() {
  const { nameAlias } = useAlias()
  const groupedAlias = groupByKey(nameAlias, 'group')

  const items = groupedAlias[ALIAS_GROUP.THREAD] || []

  return (
    <>
      {items.map((item) => (
        <Item key={item.slug} alias={item} />
      ))}
    </>
  )
}
