'use client'

import { type FC, useState } from 'react'

import { NODE_STYLE } from '~/const/node_style'
import { getDevLogoFilePath } from '~/utils/icons'
import type { TIconName } from '~/widgets/IconHub/icons'
import { getIconFilePath } from '~/widgets/IconHub/sprite'

import type { TDevLogo } from '../constant/dev_logo'
import DevTab from '../DevTab'
import type { TIconSelect, TIconTabProps, TPickerTabProvider } from '../spec'
import FootTab from './FootTab'
import IconList from './IconList'
import useSalon from './salon'
import SearchBar from './SearchBar'

const IconTab: FC<TIconTabProps> = ({ panelOpen, selectedValue, onChange }) => {
  const s = useSalon()
  const [providerTab, setProviderTab] = useState<TPickerTabProvider>('all')
  const [query, setQuery] = useState('')

  const handleSelect: TIconSelect = (provider, name) => {
    if (provider === 'dev') {
      handleDevSelect(name as TDevLogo)
      return
    }

    onChange({
      type: NODE_STYLE.ICON,
      provider,
      name: name as TIconName,
      src: getIconFilePath(provider, name),
    })
  }

  const handleDevSelect = (name: Parameters<typeof getDevLogoFilePath>[0]) => {
    onChange({
      type: NODE_STYLE.DEV,
      name,
      src: getDevLogoFilePath(name),
    })
  }

  return (
    <div className={s.wrapper}>
      <SearchBar value={query} onChange={setQuery} />
      <div className={s.listWrapper}>
        {panelOpen && providerTab === 'dev' && (
          <DevTab query={query} selectedValue={selectedValue} onSelect={handleDevSelect} />
        )}

        {panelOpen && providerTab !== 'dev' && (
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
