'use client'

import Input from '~/widgets/Input'

import { ASSETS_HUB_LABEL } from '../constant'
import useSalon from './salon/search_bar'

export default function SearchBar() {
  const s = useSalon()

  return (
    <Input
      testid='assets-hub-search'
      type='search'
      width={s.width}
      className={s.input}
      aria-label={ASSETS_HUB_LABEL.SEARCH}
      placeholder={ASSETS_HUB_LABEL.SEARCH}
    />
  )
}
