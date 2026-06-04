'use client'

import { type FC, useMemo } from 'react'

import useTrans from '~/hooks/useTrans'
import type { TNodeStyleValue } from '~/spec'
import { ICONS, PROVIDERS } from '~/widgets/IconHub/icons'
import type { TIconName, TPickerProvider } from '~/widgets/IconHub/icons'

import { DEV_LOGOS } from '../constant/dev_logo'
import type { TDevLogo } from '../constant/dev_logo'
import type { TDevLogoOption, TIconListOption, TIconOption, TIconSelect } from '../spec'
import VirtualList from '../VirtualList'
import IconListItem, { isSelectedIconOption } from './IconListItem'
import useSalon from './salon'

type TProps = {
  providerTab: TPickerProvider
  query: string
  selectedValue: TNodeStyleValue
  onSelect: TIconSelect
}

const normalizeQuery = (value: string): string => value.trim().toLowerCase().replaceAll(/\s+/g, '-')

const toDevLogoOption = (name: TDevLogo): TDevLogoOption => ({
  kind: 'dev',
  name,
})

export const isDevLogoOption = (item: TIconListOption): item is TDevLogoOption =>
  item.kind === 'dev'

const IconList: FC<TProps> = ({ providerTab, query, selectedValue, onSelect }) => {
  const s = useSalon()
  const { t } = useTrans()

  const iconOptions = useMemo<TIconListOption[]>(() => {
    const providerIcons =
      providerTab === 'all'
        ? [
            ...PROVIDERS.flatMap((provider) =>
              ICONS[provider].map<TIconOption>((name) => ({
                kind: 'icon' as const,
                provider,
                name,
              })),
            ),
            ...DEV_LOGOS.map(toDevLogoOption),
          ]
        : ICONS[providerTab].map<TIconOption>((name) => ({
            kind: 'icon' as const,
            provider: providerTab,
            name,
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
      onItemClick={(item) =>
        isDevLogoOption(item)
          ? onSelect('dev', item.name)
          : onSelect(item.provider, item.name as TIconName)
      }
      isActive={(item) => isSelectedIconOption(selectedValue, item)}
      getItemKey={(item) =>
        isDevLogoOption(item) ? `dev-${item.name}` : `${item.provider}-${item.name}`
      }
      ItemContent={IconListItem}
    />
  )
}

export default IconList
