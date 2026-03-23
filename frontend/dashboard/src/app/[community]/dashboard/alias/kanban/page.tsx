'use client'

import Item from '~/unit/dashboard-thread/Alias/Item'
import { ALIAS_GROUP } from '~/unit/dashboard-thread/constant'
import useAlias from '~/unit/dashboard-thread/hooks/useAlias'
import { groupByKey } from '~/helper'

export default function Page() {
  const { nameAlias } = useAlias()
  const groupedAlias = groupByKey(nameAlias, 'group')

  const items = groupedAlias[ALIAS_GROUP.KANBAN] || []

  return (
    <>
      {items.map((item) => (
        <Item key={item.slug} alias={item} />
      ))}
    </>
  )
}
