import type { MouseEvent, ReactNode } from 'react'

import type { TSizeSM, TSpace, TView } from '~/spec'

export type TTabItem =
  | string
  | {
      id?: string
      title?: string
      slug?: string
      href?: string
      alias?: string
      icon?: string | ReactNode
      localIcon?: string
    }

export type TSlipBarPos = 'top' | 'bottom'

export type TTabsView = TView | 'auto'

export type TTabsOnChange = (key: string, item: TTabItem, index: number) => void

export type TProps = {
  items?: readonly TTabItem[]
  /**
   * onChange 不再负责路由跳转；仅用于副作用/埋点等
   */
  onChange?: TTabsOnChange
  activeKey?: string
  size?: TSizeSM
  slipHeight?: 'px' | 0.5
  slipBarPos?: TSlipBarPos
  topSpace?: number
  bottomSpace?: number
  noAnimation?: boolean
  view?: TTabsView
} & TSpace

export type TViewProps = Omit<TProps, 'view'>

export type TTabItemClick = (index: number, e: MouseEvent<HTMLElement>) => void

export type TTabItemProps = {
  wrapMode?: boolean
  item: TTabItem
  index: number
  size: TSizeSM
  activeKey: string
  slipBarPos?: TSlipBarPos
  topSpace?: number | string
  bottomSpace?: number | string
  setItemWidth?: (index: number, width: number) => void
  onClick?: TTabItemClick
}
