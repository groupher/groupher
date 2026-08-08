import { createFileRoute } from '@tanstack/react-router'

import { groupByKey } from '~/helper'
import Item from '~/unit/DashboardThread/Alias/Item'
import { ALIAS_GROUP } from '~/unit/DashboardThread/constant'
import useAlias from '~/unit/DashboardThread/hooks/useAlias'

export const Route = createFileRoute('/$community/dash/alias/kanban')({
  component: AliasKanbanPage,
})

function AliasKanbanPage() {
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
