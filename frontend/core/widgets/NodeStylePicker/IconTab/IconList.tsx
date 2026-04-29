'use client'

import { type FC, useMemo } from 'react'

import type { TNodeStyleValue } from '~/spec'
import { ICONS, PROVIDERS } from '~/widgets/IconHub/icons'
import type { TIconName, TPickerProvider } from '~/widgets/IconHub/icons'

import type { TIconOption, TIconSelect } from '../spec'
import VirtualList from '../VirtualList'
import IconNode from './IconNode'
import useSalon from './salon'

type TProps = {
  providerTab: TPickerProvider
  selectedValue: TNodeStyleValue
  onSelect: TIconSelect
}

const IconList: FC<TProps> = ({ providerTab, selectedValue, onSelect }) => {
  const s = useSalon()

  const iconOptions = useMemo<TIconOption[]>(() => {
    if (providerTab === 'all') {
      return PROVIDERS.flatMap((provider) =>
        Object.entries(ICONS[provider]).map(([name, src]) => ({
          provider,
          name,
          src,
        })),
      )
    }

    return Object.entries(ICONS[providerTab]).map(([name, src]) => ({
      provider: providerTab,
      name,
      src,
    }))
  }, [providerTab])

  return (
    <VirtualList
      items={iconOptions}
      viewportClassName={s.viewport}
      gridRowClassName={s.gridRow}
      itemClassName={s.cell}
      itemActiveClassName={s.cellActive}
      onItemClick={(item) => onSelect(item.provider, item.name as TIconName, item.src)}
      isActive={(item) =>
        selectedValue.type === 'icon' &&
        selectedValue.provider === item.provider &&
        selectedValue.name === item.name
      }
      getItemKey={(item) => `${item.provider}-${item.name}`}
      renderItem={(item) => <IconNode item={item} iconClassName={s.iconColor} />}
    />
  )
}

export default IconList
