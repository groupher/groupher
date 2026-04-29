'use client'

import { type FC, useState } from 'react'

import { NODE_STYLE } from '~/const/node_style'
import { ICONS } from '~/widgets/IconHub/icons'
import type { TIconName, TPickerProvider } from '~/widgets/IconHub/icons'

import type { TIconSelect, TIconTabProps } from '../spec'
import FootTab from './FootTab'
import IconList from './IconList'
import useSalon from './salon'
import SearchBar from './SearchBar'

const IconTab: FC<TIconTabProps> = ({ panelOpen, selectedValue, onChange }) => {
  const s = useSalon()
  const [providerTab, setProviderTab] = useState<TPickerProvider>('all')
  const [query, setQuery] = useState('')

  const handleSelect: TIconSelect = (provider, name, src) => {
    onChange({
      type: NODE_STYLE.ICON,
      provider,
      name: name as TIconName,
      src: src || ICONS[provider][name],
    })
  }

  return (
    <div className={s.wrapper}>
      <SearchBar value={query} onChange={setQuery} />
      <div className={s.listWrapper}>
        {panelOpen && (
          <IconList
            providerTab={providerTab}
            query={query}
            selectedValue={selectedValue}
            onSelect={handleSelect}
          />
        )}
      </div>
      <FootTab value={providerTab} onChange={setProviderTab} />
    </div>
  )
}

export default IconTab
