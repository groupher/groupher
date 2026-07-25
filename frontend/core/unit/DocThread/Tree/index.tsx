import type { FC } from 'react'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'

import type { TDocPublicTreeGroup, TDocPublicTreeNavigationNode } from '~/spec'

import Group from './Group'
import { filterTreeNodes, normalizeNodeType } from './helper'
import Item from './Item'
import useSalon from './salon'
import Toolbar from './Toolbar'

type TProps = {
  compact?: boolean
  nodes: readonly TDocPublicTreeNavigationNode[]
  onToggleTree?: () => void
}

const Tree: FC<TProps> = ({ compact = false, nodes, onToggleTree }) => {
  const s = useSalon({ compact })
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<ReadonlySet<string>>(() => new Set())
  const deferredQuery = useDeferredValue(query)
  const activeSearch = searching && deferredQuery.trim().length > 0
  const groupIds = useMemo(
    () => nodes.filter((node) => normalizeNodeType(node.type) === 'group').map((node) => node.id),
    [nodes],
  )
  const visibleNodes = useMemo(() => filterTreeNodes(nodes, deferredQuery), [nodes, deferredQuery])
  const groupsCollapsed =
    groupIds.length > 0 && groupIds.every((groupId) => collapsedGroupIds.has(groupId))

  useEffect(() => {
    setCollapsedGroupIds((prev) => {
      const next = new Set(groupIds.filter((groupId) => prev.has(groupId)))

      return next.size === prev.size ? prev : next
    })
  }, [groupIds])

  if (nodes.length === 0) return null

  const handleCloseSearch = (): void => {
    setSearching(false)
    setQuery('')
  }

  const handleToggleGroup = (groupId: string): void => {
    setCollapsedGroupIds((prev) => {
      const next = new Set(prev)

      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }

      return next
    })
  }

  const handleToggleGroups = (): void => {
    setCollapsedGroupIds(groupsCollapsed ? new Set() : new Set(groupIds))
  }

  return (
    <nav className={s.wrapper} aria-label='Docs'>
      <div className={s.inner}>
        <Toolbar
          groupsCollapsed={groupsCollapsed}
          query={query}
          searching={searching}
          onChangeQuery={setQuery}
          onCloseSearch={handleCloseSearch}
          onToggleGroups={handleToggleGroups}
          onToggleTree={compact ? undefined : onToggleTree}
          onOpenSearch={() => setSearching(true)}
        />

        <div className={s.groupList}>
          {visibleNodes.length > 0 ? (
            visibleNodes.map((node) =>
              normalizeNodeType(node.type) === 'group' ? (
                <Group
                  key={node.id}
                  collapsed={collapsedGroupIds.has(node.id)}
                  forceOpen={activeSearch}
                  group={node as TDocPublicTreeGroup}
                  onToggle={handleToggleGroup}
                />
              ) : (
                <Item key={node.id} item={node} />
              ),
            )
          ) : (
            <div className={s.empty}>No matching docs</div>
          )}
        </div>
      </div>
    </nav>
  )
}

export default Tree
