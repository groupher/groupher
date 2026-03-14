'use client'

import Item from '~/containers/thread/DashboardThread/Alias/Item'
import { ALIAS_GROUP } from '~/containers/thread/DashboardThread/constant'
import useAlias from '~/containers/thread/DashboardThread/logic/useAlias'
import { groupByKey } from '~/helper'

export default function Page() {
  const { nameAlias } = useAlias()
  const groupedAlias = groupByKey(nameAlias, 'group')

  const items = groupedAlias[ALIAS_GROUP.OTHERS] || []

  return (
    <>
      {items.map((item) => (
        <Item key={item.slug} alias={item} />
      ))}
    </>
  )
}
