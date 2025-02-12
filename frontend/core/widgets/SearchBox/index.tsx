/*
 *
 * SearchBox
 *
 */

import type { FC } from 'react'

import type { TSpace } from '~/spec'
import { openSearch } from '~/signal'

import SearchSVG from '~/icons/HeaderSearch'

import useSalon from './salon'

type TProps = {
  testid?: string
} & TSpace

const SearchBox: FC<TProps> = ({ testid = 'search-box', ...spacing }) => {
  const s = useSalon({ ...spacing })

  return (
    <div className={s.wrapper} onClick={() => openSearch()}>
      <SearchSVG className={s.icon} />
      <div className={s.text}>搜索内容</div>
    </div>
  )
}

export default SearchBox
