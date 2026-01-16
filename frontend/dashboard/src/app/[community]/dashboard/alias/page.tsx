'use client'

import Item from '~/containers/thread/DashboardThread/Alias/Item'
import { ALIAS_GROUP } from '~/containers/thread/DashboardThread/constant'
import useAlias from '~/containers/thread/DashboardThread/logic/useAlias'
import { groupByKey } from '~/helper'

export default () => {
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
