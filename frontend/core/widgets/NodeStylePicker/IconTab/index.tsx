'use client'

import { type FC, useState } from 'react'

import { ICONS } from '~/widgets/IconHub/icons'
import type { TIconName, TPickerProvider } from '~/widgets/IconHub/icons'

import FootTab from './FootTab'
import IconList from './IconList'
import SearchBar from './SearchBar'

import type { TIconSelect, TIconTabProps } from '../spec'

const IconTab: FC<TIconTabProps> = ({ panelOpen, selectedValue, onChange }) => {
  const [providerTab, setProviderTab] = useState<TPickerProvider>('all')

  const handleSelect: TIconSelect = (provider, name, src) => {
    onChange({
      type: 'icon',
      provider,
      name: name as TIconName,
      src: src || ICONS[provider][name],
    })
  }

  return (
    <>
      <SearchBar />
      {panelOpen && (
        <IconList
          providerTab={providerTab}
          selectedValue={selectedValue}
          onSelect={handleSelect}
        />
      )}
      <FootTab value={providerTab} onChange={setProviderTab} />
    </>
  )
}

export default IconTab
