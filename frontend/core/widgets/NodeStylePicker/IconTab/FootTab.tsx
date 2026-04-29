'use client'

import { type FC, useMemo } from 'react'

import useTrans from '~/hooks/useTrans'
import BlocksSVG from '~/icons/Blocks'
import type { TPickerProvider } from '~/widgets/IconHub/icons'
import { PillTabs } from '~/widgets/Switcher'
import type { TPillTabItem } from '~/widgets/Switcher'

import type { TProviderTabsProps } from '../spec'
import useSalon from './salon/footer_tab'

const PROVIDER_KEYS = ['all', 'fa', 'lucide', 'heroicons', 'phosphor'] as const

const PROVIDER_ICON_MAP = {
  all: {
    iconComp: <BlocksSVG />,
  },
  fa: {
    icon: '/icons/providers/fa.png',
  },
  lucide: {
    icon: '/icons/providers/lucide.png',
  },
  heroicons: {
    icon: '/icons/providers/heroicons.png',
  },
  phosphor: {
    icon: '/icons/providers/phosphor.png',
  },
} as const

const getProviderLabel = (key: TPickerProvider, t: ReturnType<typeof useTrans>['t']): string => {
  switch (key) {
    case 'all':
      return t('all_icons')
    case 'fa':
      return 'Font Awesome'
    case 'lucide':
      return 'Lucide'
    case 'heroicons':
      return 'Heroicons'
    case 'phosphor':
      return 'Phosphor'
    default:
      return key
  }
}

const FootTab: FC<TProviderTabsProps> = ({ value, onChange }) => {
  const s = useSalon()
  const { t } = useTrans()
  const providerItems = useMemo<readonly TPillTabItem[]>(
    () =>
      PROVIDER_KEYS.map((key) => ({
        key,
        label: getProviderLabel(key, t),
        ...PROVIDER_ICON_MAP[key],
      })),
    [t],
  )

  return (
    <div className={s.wrapper}>
      <PillTabs
        items={providerItems}
        activeKey={value}
        size='small'
        left={4}
        onChange={(key) => onChange(key as TPickerProvider)}
      />
    </div>
  )
}

export default FootTab
