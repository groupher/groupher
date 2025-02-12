/*
 * Tooltip

 * use custom animation Globally at GlobalStyle.ts
 */

import { type FC, type ReactNode, memo, createContext } from 'react'

import type { TTooltipPlacement } from '~/spec'
import RealTooltip from './RealTooltip'

// @ts-ignore
const TooltipContext = createContext()

export type TProps = {
  children: ReactNode
  content: string | ReactNode
  placement?: TTooltipPlacement
  // more options see: https://atomiks.github.io/tippyjs/all-options/
  delay?: number
  offset?: [number, number]
  duration?: number
  trigger?: 'mouseenter focus' | 'click'
  hideOnClick?: boolean
  noPadding?: boolean
  behavior?: 'default' | 'confirm' | 'delete-confirm' | 'add'
  // currently only for Facepile, it will collapse the height
  // for same reason, figure out later
  contentHeight?: string

  /**
   * z-index is a magic number for IconSwitcher's mask situation,
   * DO NOT USE unless you know what you are doing
   *  在类似 IconSwitcher 的场景下（有一个基于 positon: absolute 的滑动遮罩）的场景下，需要将外层
   * 的 ChildrenWrapper z-index 置为 1, 否则滑动遮罩会在最外面。
   *
   * 理论上 zIndex 一直设置为 1，也没问题，但是会导致某些使用了 Tooltip 的地方有严重的粘滞感，比如 “CopyRight” 那里。
   * 暂时没有精力看 Tippy 的具体实现，小心使用。
   */
  forceZIndex?: boolean
  interactive?: boolean

  visible?: boolean | null

  onShow?: () => void
  onHide?: () => void
  onConfirm?: () => void
}

const Tooltip: FC<TProps> = (props) => {
  const { children } = props
  return (
    <TooltipContext.Provider value={{ children }}>
      {/* @ts-ignore */}
      <RealTooltip {...props} />
    </TooltipContext.Provider>
  )
}

export default memo(Tooltip)
