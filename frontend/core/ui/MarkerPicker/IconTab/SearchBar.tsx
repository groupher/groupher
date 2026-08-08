'use client'

import type { ChangeEvent, FC } from 'react'
import { useState } from 'react'

import useTrans from '~/hooks/useTrans'
import CloseLightSVG from '~/icons/CloseLight'
import SearchSVG from '~/icons/HeaderSearch'

import useSalon from './salon'

type TProps = {
  value: string
  onChange: (value: string) => void
}

const SearchBar: FC<TProps> = ({ value, onChange }) => {
  const s = useSalon()
  const { t } = useTrans()
  const [focused, setFocused] = useState(false)

  const updateSearchValue = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value)
  }

  const handleClear = () => {
    onChange('')
  }

  return (
    <div className={s.searchWrapper}>
      <div className={s.searchBox(focused)}>
        <SearchSVG className={s.searchIcon} />
        <input
          type='search'
          value={value}
          onChange={updateSearchValue}
          placeholder={t('search')}
          aria-label={t('search')}
          autoComplete='off'
          spellCheck={false}
          className={s.searchInput}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {value && (
          <button
            type='button'
            className={s.clearButton}
            onClick={handleClear}
            aria-label={t('clear_search')}
          >
            <CloseLightSVG className={s.clearIcon} />
          </button>
        )}
      </div>
    </div>
  )
}

export default SearchBar
