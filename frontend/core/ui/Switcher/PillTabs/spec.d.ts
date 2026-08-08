import type { KeyboardEvent, ReactNode } from 'react'

import type { TSizeSM, TSpace } from '~/spec'

export type TPillTabItem = {
  key: string
  label: ReactNode
  icon?: string
  iconComp?: ReactNode
  disabled?: boolean
}

export type TPillTabsOnChange = (key: string, item: TPillTabItem, index: number) => void

export type TProps = {
  items: readonly TPillTabItem[]
  activeKey: string
  onChange?: TPillTabsOnChange
  className?: string
  itemClassName?: string
  size?: TSizeSM
} & TSpace

export type TPillTabItemProps = {
  item: TPillTabItem
  index: number
  active: boolean
  itemClassName?: string
  size: TSizeSM
  onClick?: (index: number) => void
  onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>, index: number) => void
}
