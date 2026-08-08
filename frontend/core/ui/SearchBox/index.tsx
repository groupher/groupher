/*
 *
 * SearchBox
 *
 */

import type { FC } from 'react'

import SearchSVG from '~/icons/HeaderSearch'
import { openSearch } from '~/signal'
import type { TSpace } from '~/spec'

import useSalon from './salon'

type TProps = {
  testid?: string
} & TSpace

const SearchBox: FC<TProps> = ({ testid: _testid = 'search-box', ...spacing }) => {
  const s = useSalon({ ...spacing })

  return (
    <button type='button' className={s.wrapper} onClick={() => openSearch()}>
      <SearchSVG className={s.icon} />
      <div className={s.text}>搜索内容</div>
    </button>
  )
}

export default SearchBox
