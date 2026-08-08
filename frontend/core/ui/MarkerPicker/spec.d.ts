import type { ComponentType } from 'react'

import type { TColorName, TMarkerValue } from '~/spec'
import type { TIconName, TPickerProvider } from '~/ui/IconHub/icons'
import type { TIconProvider, TMarkerIconProvider } from '~/ui/IconHub/sprite'
import type { TDevLogo } from '~/ui/MarkerPicker/constant/dev_logo'

import type { TAB_ITEMS } from './constant'

export type TTab = (typeof TAB_ITEMS)[number]['slug']
export type TActiveAppearanceValue = TColorName | string

export type TMarkerPickerProps = {
  testid?: string
  value?: TMarkerValue | null
  compact?: boolean
  active?: boolean
  // Context overrides (for example Tag Editor); Marker appearance remains the fallback.
  activeColor?: TActiveAppearanceValue
  activeBg?: TActiveAppearanceValue
  appearance?: boolean
  triggerClassName?: string
  iconSize?: number
  onChange?: (value: TMarkerValue) => void
}

export type TIconOption = {
  type: 'icon'
  provider: TIconProvider
  name: string
}

export type TDevLogoOption = {
  type: 'dev'
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
  selectedValue: TMarkerValue
  activeColor?: string
  activeBg?: string
  onChange: (value: TMarkerValue) => void
}

export type TProviderTabsProps = {
  value: TPickerTabProvider
  onChange: (value: TPickerTabProvider) => void
}

export type TIconSelect = (provider: TMarkerIconProvider, name: TIconName | TDevLogo) => void
