import type { FC } from 'react'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'

import type { TDocPublicTreeGroup } from '~/spec'

import Group from './Group'
import { filterTreeGroups } from './helper'
import useSalon from './salon'
import Toolbar from './Toolbar'

type TProps = {
  compact?: boolean
  groups: readonly TDocPublicTreeGroup[]
  onToggleTree?: () => void
}

const Tree: FC<TProps> = ({ compact = false, groups, onToggleTree }) => {
  const s = useSalon({ compact })
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<ReadonlySet<string>>(() => new Set())
  const deferredQuery = useDeferredValue(query)
  const activeSearch = searching && deferredQuery.trim().length > 0
  const groupIds = useMemo(() => groups.map((group) => group.id), [groups])
  const visibleGroups = useMemo(
    () => filterTreeGroups(groups, deferredQuery),
    [groups, deferredQuery],
  )
  const groupsCollapsed =
    groups.length > 0 && groupIds.every((groupId) => collapsedGroupIds.has(groupId))

  useEffect(() => {
    setCollapsedGroupIds((prev) => {
      const next = new Set(groupIds.filter((groupId) => prev.has(groupId)))

      return next.size === prev.size ? prev : next
    })
  }, [groupIds])

  if (groups.length === 0) return null

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
          {visibleGroups.length > 0 ? (
            visibleGroups.map((group) => (
              <Group
                key={group.id}
                collapsed={collapsedGroupIds.has(group.id)}
                forceOpen={activeSearch}
                group={group}
                onToggle={handleToggleGroup}
              />
            ))
          ) : (
            <div className={s.empty}>No matching docs</div>
          )}
        </div>
      </div>
    </nav>
  )
}

export default Tree
