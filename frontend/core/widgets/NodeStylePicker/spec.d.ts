import type { ComponentType } from 'react'

import type { TNodeStyleIconValue, TNodeStyleValue } from '~/spec'
import type { TIconName, TIconProvider, TPickerProvider } from '~/widgets/IconHub/icons'

import type { TAB } from './constant'

export type TTab = (typeof TAB)[keyof typeof TAB]

export type TNodeStylePickerProps = {
  testid?: string
  value?: TNodeStyleValue | null
  compact?: boolean
  active?: boolean
  onChange?: (value: TNodeStyleValue) => void
}

export type TIconOption = {
  provider: TIconProvider
  name: string
  src: string
}

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
  value: TPickerProvider
  onChange: (value: TPickerProvider) => void
}

export type TIconSelect = (provider: TIconProvider, name: TIconName, src: string) => void
