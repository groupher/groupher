'use client'

import { ALIAS_GROUP } from '~/containers/thread/DashboardThread//constant'
import Item from '~/containers/thread/DashboardThread/Alias/Item'
import useAlias from '~/containers/thread/DashboardThread/logic/useAlias'
import { groupByKey } from '~/helper'

export default () => {
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
