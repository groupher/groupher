'use client'

import type { ChangeEvent } from 'react'
import { useState } from 'react'

import MagnifyingGlassIcon from '~/icons/MagnifyingGlass'
import Input from '~/widgets/Input'
import Tooltip from '~/widgets/Tooltip'

import { ASSETS_HUB_LABEL } from '../constant'
import useSalon from './salon/search_bar'

type TProps = {
  query: string
  onQueryChange: (query: string) => void
}

export default function SearchBar({ query, onQueryChange }: TProps) {
  const s = useSalon()
  const [expanded, setExpanded] = useState(false)
  const visible = expanded || query.trim().length > 0

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onQueryChange(event.currentTarget.value)
  }

  if (!visible) {
    return (
      <Tooltip content={ASSETS_HUB_LABEL.SEARCH} placement='top'>
        <button
          type='button'
          className={s.button}
          aria-label={ASSETS_HUB_LABEL.SEARCH}
          onClick={() => setExpanded(true)}
        >
          <MagnifyingGlassIcon className={s.buttonIcon} />
        </button>
      </Tooltip>
    )
  }

  return (
    <div className={s.wrapper}>
      <MagnifyingGlassIcon className={s.icon} />
      <Input
        autoFocus
        testid='assets-hub-search'
        type='search'
        width={s.width}
        className={s.input}
        value={query}
        aria-label={ASSETS_HUB_LABEL.SEARCH}
        placeholder={ASSETS_HUB_LABEL.SEARCH_SHORT}
        onChange={handleChange}
        onBlur={() => {
          if (!query.trim()) setExpanded(false)
        }}
      />
    </div>
  )
}
