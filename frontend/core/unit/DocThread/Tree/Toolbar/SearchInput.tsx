import { type ChangeEvent, type FC } from 'react'

import CloseSVG from '~/icons/CloseLight'
import MagnifyingGlassSVG from '~/icons/MagnifyingGlass'
import Input from '~/ui/Input'

import { DOC_PUBLIC_TREE_LABEL, DOC_PUBLIC_TREE_SEARCH_INPUT_TESTID } from '../constant'
import useSalon from './salon/search_input'

type TProps = {
  query: string
  searching: boolean
  onChangeQuery: (query: string) => void
  onCloseSearch: () => void
  onOpenSearch: () => void
}

const SearchInput: FC<TProps> = ({
  query,
  searching,
  onChangeQuery,
  onCloseSearch,
  onOpenSearch,
}) => {
  const s = useSalon()

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onChangeQuery(event.target.value)
  }

  if (searching) {
    return (
      <div className={s.field}>
        <MagnifyingGlassSVG className={s.inputIcon} />
        <Input
          autoFocus
          testid={DOC_PUBLIC_TREE_SEARCH_INPUT_TESTID}
          width={s.inputWidth}
          className={s.input}
          value={query}
          placeholder={DOC_PUBLIC_TREE_LABEL.search}
          onChange={handleInputChange}
        />
        <button
          type='button'
          className={s.closeButton}
          aria-label={DOC_PUBLIC_TREE_LABEL.clearSearch}
          title={DOC_PUBLIC_TREE_LABEL.clearSearch}
          onClick={onCloseSearch}
        >
          <CloseSVG className={s.closeIcon} />
        </button>
      </div>
    )
  }

  return (
    <button
      type='button'
      className={s.searchButton}
      aria-label={DOC_PUBLIC_TREE_LABEL.search}
      title={DOC_PUBLIC_TREE_LABEL.search}
      onClick={onOpenSearch}
    >
      <MagnifyingGlassSVG className={s.searchIcon} />
      <span className={s.searchText}>{DOC_PUBLIC_TREE_LABEL.search}</span>
    </button>
  )
}

export default SearchInput
