import { createFileRoute } from '@tanstack/react-router'

import { groupByKey } from '~/helper'
import Item from '~/unit/DsbThread/Alias/Item'
import { ALIAS_GROUP } from '~/unit/DsbThread/constant'
import useAlias from '~/unit/DsbThread/hooks/useAlias'

export const Route = createFileRoute('/$community/alias/others')({
  component: AliasOthersPage,
})

function AliasOthersPage() {
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
