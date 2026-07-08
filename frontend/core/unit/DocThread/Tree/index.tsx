import type { FC } from 'react'
import { useDeferredValue, useMemo, useState } from 'react'

import type { TDocPublicTreeGroup } from '~/spec'

import Group from './Group'
import { filterTreeGroups } from './helper'
import useSalon from './salon'
import Toolbar from './Toolbar'

type TProps = {
  compact?: boolean
  groups: readonly TDocPublicTreeGroup[]
}

const Tree: FC<TProps> = ({ compact = false, groups }) => {
  const s = useSalon({ compact })
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const activeSearch = searching && deferredQuery.trim().length > 0
  const visibleGroups = useMemo(
    () => filterTreeGroups(groups, deferredQuery),
    [groups, deferredQuery],
  )

  if (groups.length === 0) return null

  const handleCloseSearch = (): void => {
    setSearching(false)
    setQuery('')
  }

  return (
    <nav className={s.wrapper} aria-label='Docs'>
      <div className={s.inner}>
        <Toolbar
          query={query}
          searching={searching}
          onChangeQuery={setQuery}
          onCloseSearch={handleCloseSearch}
          onOpenSearch={() => setSearching(true)}
        />

        <div className={s.groupList}>
          {visibleGroups.length > 0 ? (
            visibleGroups.map((group) => (
              <Group key={group.id} group={group} forceOpen={activeSearch} />
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
