'use client'

import type { ChangeEvent, FC } from 'react'

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

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value)
  }

  const handleClear = () => {
    onChange('')
  }

  return (
    <div className={s.searchWrapper}>
      <label className={s.searchBox}>
        <SearchSVG className={s.searchIcon} />
        <input
          type='search'
          value={value}
          onChange={handleChange}
          placeholder={t('search')}
          autoComplete='off'
          spellCheck={false}
          className={s.searchInput}
        />
        {value && (
          <button
            type='button'
            className={s.clearButton}
            onClick={handleClear}
            aria-label='clear search'
          >
            <CloseLightSVG className={s.clearIcon} />
          </button>
        )}
      </label>
    </div>
  )
}

export default SearchBar
