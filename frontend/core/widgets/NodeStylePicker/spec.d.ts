import type { ComponentType } from 'react'

import type { TNodeStyleValue } from '~/spec'
import type { TIconName, TIconProvider, TPickerProvider } from '~/widgets/IconHub/icons'
import type { TDevLogo } from '~/widgets/NodeStylePicker/constant/dev_logo'

import type { TAB_ITEMS } from './constant'

export type TTab = (typeof TAB_ITEMS)[number]['slug']

export type TNodeStylePickerProps = {
  testid?: string
  value?: TNodeStyleValue | null
  compact?: boolean
  active?: boolean
  onChange?: (value: TNodeStyleValue) => void
}

export type TIconOption = {
  kind: 'icon'
  provider: TIconProvider
  name: string
}

export type TDevLogoOption = {
  kind: 'dev'
  name: TDevLogo
}

export type TIconListOption = TIconOption | TDevLogoOption

export type TPickerTabProvider = TPickerProvider | 'dev'

export type TVirtualListProps<T> = {
  items: T[]
  viewportClassName: string
  gridRowClassName: string
  itemClassName: string
  itemActiveClassName: string
  isActive?: (item: T) => boolean
  onItemClick?: (item: T) => void
  getItemKey: (item: T) => string
  ItemContent: ComponentType<{ item: T; active: boolean }>
}

export type TIconTabProps = {
  panelOpen: boolean
  selectedValue: TNodeStyleValue
  onChange: (value: TNodeStyleValue) => void
}

export type TProviderTabsProps = {
  value: TPickerTabProvider
  onChange: (value: TPickerTabProvider) => void
}

export type TIconSelect = (provider: TIconProvider | 'dev', name: TIconName | TDevLogo) => void
