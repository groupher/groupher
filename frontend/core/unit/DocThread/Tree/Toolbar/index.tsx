import type { FC } from 'react'

import GroupToggle from './GroupToggle'
import useSalon from './salon'
import SearchInput from './SearchInput'
import SideTreeToggle from './SideTreeToggle'

type TProps = {
  groupsCollapsed: boolean
  query: string
  searching: boolean
  onChangeQuery: (query: string) => void
  onCloseSearch: () => void
  onToggleGroups: () => void
  onToggleTree?: () => void
  onOpenSearch: () => void
}

const Toolbar: FC<TProps> = ({
  groupsCollapsed,
  query,
  searching,
  onChangeQuery,
  onCloseSearch,
  onOpenSearch,
  onToggleGroups,
  onToggleTree,
}) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <SearchInput
        query={query}
        searching={searching}
        onChangeQuery={onChangeQuery}
        onCloseSearch={onCloseSearch}
        onOpenSearch={onOpenSearch}
      />

      {!searching && (
        <div className={s.actions}>
          <GroupToggle collapsed={groupsCollapsed} onToggle={onToggleGroups} />

          {!!onToggleTree && <SideTreeToggle onToggle={onToggleTree} />}
        </div>
      )}
    </div>
  )
}

export default Toolbar
