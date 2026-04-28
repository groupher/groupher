'use client'

import { type FC } from 'react'

import { PICKER_PROVIDERS } from '~/widgets/IconHub/icons'
import type { TPickerProvider } from '~/widgets/IconHub/icons'
import { Tabs } from '~/widgets/Switcher'

import type { TProviderTabsProps } from '../spec'

const FootTab: FC<TProviderTabsProps> = ({ value, onChange }) => {
  return (
    <Tabs
      items={[...PICKER_PROVIDERS]}
      activeKey={value}
      onChange={(key) => onChange(key as TPickerProvider)}
      slipBarPos='top'
      topSpace={0}
      left={2}
      top={1}
    />
  )
}

export default FootTab
