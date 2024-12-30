import { useMemo } from 'react'
import { zIndex } from '~/css'
import { pixelAdd } from '~/dom'

import { NARROW_HEIGHT_OFFSET } from '../constant'
import { getDesktopTransform, isWideMode, getDrawerWidth, getDrawerMinWidth } from './metrics'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  visible: boolean
  type: string
  rightOffset?: string
  fromContentEdge?: boolean
}

export default ({ visible, type, rightOffset = '0px', fromContentEdge = true }: TProps) => {
  const { cn, bg, br, shadow } = useTwBelt()

  const drawerStyle = useMemo(
    () => ({
      transform: getDesktopTransform(visible, fromContentEdge),
      transition: 'transform 850ms cubic-bezier(0.23, 1, 0.32, 1) 0ms',
      right: isWideMode(type) ? rightOffset : pixelAdd(rightOffset, 30),
      width: getDrawerWidth(type),
      minWidth: getDrawerMinWidth(type),
      zIndex: visible ? zIndex.drawer : -1,
      maxWidth: '985px',
      transitionDelay: '0s, 0s, 0.14s',
    }),
    [visible, fromContentEdge, type, rightOffset],
  )

  return {
    overlay: cn(
      'fixed bottom-0 left-0 overflow-auto h-full w-full',
      visible ? cn('visible opacity-50', bg('drawer.mask')) : 'hidden',
    ),
    overlayStyle: {
      zIndex: zIndex.drawerOverlay,
      transition: 'visibility 0.1s ease-in, opacity 0.1s ease-in, background 0.1s ease-in',
    },

    drawerContent: cn(
      'relative w-full border rounded-tl-md',
      br('divider'),
      bg('card'),
      !isWideMode(type) && 'rounded-md',
      shadow('drawer'),
    ),
    drawerContentStyle: {
      height: isWideMode(type) ? '100vh' : `calc(100vh - ${NARROW_HEIGHT_OFFSET * 2}px)`,
    },
    drawer: cn(
      'fixed row h-full will-change-transform box-border',
      isWideMode(type) ? 'top-0' : 'top-5',
      visible ? 'visible' : 'hidden',
    ),
    drawerStyle,
  }
}
