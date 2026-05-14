'use client'

import { type FC, useMemo } from 'react'

import useTrans from '~/hooks/useTrans'
import type { TNodeStyleValue } from '~/spec'
import { ICONS, PROVIDERS } from '~/widgets/IconHub/icons'
import type { TIconName, TPickerProvider } from '~/widgets/IconHub/icons'

import type { TIconOption, TIconSelect } from '../spec'
import VirtualList from '../VirtualList'
import IconListItem, { isSelectedIcon } from './IconListItem'
import useSalon from './salon'

type TProps = {
  providerTab: TPickerProvider
  query: string
  selectedValue: TNodeStyleValue
  onSelect: TIconSelect
}

const normalizeQuery = (value: string): string => value.trim().toLowerCase().replaceAll(/\s+/g, '-')

const IconList: FC<TProps> = ({ providerTab, query, selectedValue, onSelect }) => {
  const s = useSalon()
  const { t } = useTrans()

  const iconOptions = useMemo<TIconOption[]>(() => {
    const providerIcons =
      providerTab === 'all'
        ? PROVIDERS.flatMap((provider) =>
            Object.entries(ICONS[provider]).map(([name, src]) => ({
              provider,
              name,
              src,
            })),
          )
        : Object.entries(ICONS[providerTab]).map(([name, src]) => ({
            provider: providerTab,
            name,
            src,
          }))

    const normalizedQuery = normalizeQuery(query)
    if (!normalizedQuery) return providerIcons

    return providerIcons.filter(({ name }) => {
      const normalizedName = name.toLowerCase()
      return (
        normalizedName.includes(normalizedQuery) ||
        normalizedName.replaceAll('-', '').includes(normalizedQuery.replaceAll('-', ''))
      )
    })
  }, [providerTab, query])

  if (iconOptions.length === 0) {
    return <div className={s.emptyState}>{t('no_icon_found')}</div>
  }

  return (
    <VirtualList
      items={iconOptions}
      viewportClassName={s.viewport}
      gridRowClassName={s.gridRow}
      itemClassName={s.cell}
      itemActiveClassName={s.cellActive}
      onItemClick={(item) => onSelect(item.provider, item.name as TIconName, item.src)}
      isActive={(item) => isSelectedIcon(selectedValue, item)}
      getItemKey={(item) => `${item.provider}-${item.name}`}
      ItemContent={IconListItem}
    />
  )
}

export default IconList
