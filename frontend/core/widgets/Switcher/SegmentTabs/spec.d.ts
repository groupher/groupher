import type { KeyboardEvent, ReactNode } from 'react'

import type { TSizeSM, TSpace } from '~/spec'

export type TSegmentTabItem = {
  key: string
  label: ReactNode
  disabled?: boolean
}

export type TSegmentTabsOnChange = (key: string, item: TSegmentTabItem, index: number) => void

export type TProps = {
  items: readonly TSegmentTabItem[]
  activeKey: string
  onChange?: TSegmentTabsOnChange
  className?: string
  itemClassName?: string
  size?: TSizeSM
} & TSpace

export type TSegmentTabItemProps = {
  item: TSegmentTabItem
  index: number
  active: boolean
  itemClassName?: string
  size: TSizeSM
  onClick?: (index: number) => void
  onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>, index: number) => void
}
