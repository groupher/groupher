'use client'

import type { TAssetListViewMode } from '../spec'
import type { TAssetThreadFilter } from '../spec'
import FilterButton from './FilterButton'
import LayoutSwitcher from './LayoutSwitcher'
import useSalon from './salon'
import SearchBar from './SearchBar'
import ThreadTabs from './ThreadTabs'

type TProps = {
  activeThread: TAssetThreadFilter
  searchQuery: string
  viewMode: TAssetListViewMode
  onSearchQueryChange: (query: string) => void
  onThreadChange: (thread: TAssetThreadFilter) => void
  onViewModeChange: (mode: TAssetListViewMode) => void
}

export default function Toolbar({
  activeThread,
  searchQuery,
  viewMode,
  onSearchQueryChange,
  onThreadChange,
  onViewModeChange,
}: TProps) {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <ThreadTabs activeThread={activeThread} onThreadChange={onThreadChange} />

      <div className={s.actions}>
        <SearchBar query={searchQuery} onQueryChange={onSearchQueryChange} />
        <FilterButton />
        <LayoutSwitcher viewMode={viewMode} onViewModeChange={onViewModeChange} />
      </div>
    </div>
  )
}
