import { type ChangeEvent, type FC } from 'react'

import CloseSVG from '~/icons/CloseLight'
import MagnifyingGlassSVG from '~/icons/MagnifyingGlass'
import Input from '~/widgets/Input'

import useSalon from './salon/toolbar'

const SEARCH_LABEL = 'Search'
const SEARCH_CLEAR_LABEL = 'Clear docs search'

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
            testid='docs-public-tree-search-input'
            width='w-full'
            className={s.searchInput}
            value={query}
            placeholder={SEARCH_LABEL}
            onChange={handleInputChange}
          />
          <button
            type='button'
            className={s.closeSearch}
            aria-label={SEARCH_CLEAR_LABEL}
            title={SEARCH_CLEAR_LABEL}
            onClick={onCloseSearch}
          >
            <CloseSVG className={s.closeIcon} />
          </button>
        </div>
      ) : (
        <button
          type='button'
          className={s.search}
          aria-label={SEARCH_LABEL}
          title={SEARCH_LABEL}
          onClick={onOpenSearch}
        >
          <MagnifyingGlassSVG className={s.searchIcon} />
          <span className={s.searchText}>{SEARCH_LABEL}</span>
        </button>
      )}
    </div>
  )
}

export default Toolbar
