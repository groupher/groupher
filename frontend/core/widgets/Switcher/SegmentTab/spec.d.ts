import type { ComponentType, KeyboardEvent, SVGProps } from 'react'

export type TSegmentTabIcon = ComponentType<SVGProps<SVGSVGElement>>

export type TSegmentTabOption = {
  key: string
  label: string
  icon?: TSegmentTabIcon
  disabled?: boolean
}

export type TSegmentTabOnChange = (key: string, item: TSegmentTabOption, index: number) => void

export type TSegmentTabProps = {
  items: readonly TSegmentTabOption[]
  activeKey: string
  ariaLabel?: string
  className?: string
  onChange?: TSegmentTabOnChange
}

export type TSegmentTabOptionProps = {
  item: TSegmentTabOption
  index: number
  active: boolean
  onClick: (index: number) => void
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, index: number) => void
}
