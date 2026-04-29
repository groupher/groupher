'use client'

import { type FC, useState } from 'react'

import { ICONS } from '~/widgets/IconHub/icons'
import type { TIconName, TPickerProvider } from '~/widgets/IconHub/icons'

import type { TIconSelect, TIconTabProps } from '../spec'
import FootTab from './FootTab'
import IconList from './IconList'
import SearchBar from './SearchBar'

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
    <div className='flex h-full min-h-0 flex-col'>
      <SearchBar />
      <div className='min-h-0 flex-1'>
        {panelOpen && (
          <IconList
            providerTab={providerTab}
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
