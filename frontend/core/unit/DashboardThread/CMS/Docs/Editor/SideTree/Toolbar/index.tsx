import { type ChangeEvent, type ComponentType, type FC, type SVGProps } from 'react'

import CloseSVG from '~/icons/CloseLight'
import FilePlusSVG from '~/icons/FilePlus'
import FolderPlusSVG from '~/icons/FolderPlus'
import MagnifyingGlassSVG from '~/icons/MagnifyingGlass'
import MapPinPlusSVG from '~/icons/MapPinPlus'
import MoreSVG from '~/icons/menu/MoreL'
import Input from '~/widgets/Input'

import useSalon from '../salon/toolbar'

type TToolbarAction = {
  label: string
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  compact?: boolean
}

const ACTIONS: TToolbarAction[] = [
  { label: 'Top', Icon: MapPinPlusSVG },
  { label: 'Group', Icon: FolderPlusSVG },
  { label: 'Doc', Icon: FilePlusSVG },
  { label: 'More', Icon: MoreSVG, compact: true },
]

type TProps = {
  query: string
  searching: boolean
  onChangeQuery: (query: string) => void
  onCloseSearch: () => void
  onOpenSearch: () => void
}

const Toolbar: FC<TProps> = ({ query, searching, onChangeQuery, onCloseSearch, onOpenSearch }) => {
  const s = useSalon()

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onChangeQuery(event.target.value)
  }

  return (
    <div className={s.wrapper}>
      {searching ? (
        <div className={s.searchField}>
          <MagnifyingGlassSVG className={s.searchInputIcon} />
          <Input
            autoFocus
            testid='docs-side-tree-search-input'
            width='w-full'
            className={s.searchInput}
            value={query}
            placeholder='Search'
            onChange={handleInputChange}
          />
          <button
            type='button'
            className={s.closeSearch}
            aria-label='Clear docs tree search'
            title='Clear search'
            onClick={onCloseSearch}
          >
            <CloseSVG className={s.closeIcon} />
          </button>
        </div>
      ) : (
        <button
          type='button'
          className={s.search}
          aria-label='Search docs tree'
          title='Search'
          onClick={onOpenSearch}
        >
          <MagnifyingGlassSVG className={s.searchIcon} />
          <span className={s.searchText}>Search</span>
        </button>
      )}

      {!searching && (
        <div className={s.actions}>
          {ACTIONS.map(({ label, Icon, compact }) => (
            <button
              key={label}
              type='button'
              className={compact ? s.moreButton : s.actionButton}
              aria-label={compact ? 'More tree actions' : `Add ${label}`}
              title={compact ? 'More tree actions' : `Add ${label}`}
            >
              <Icon className={s.actionIcon} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default Toolbar
