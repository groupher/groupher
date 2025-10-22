export { cn } from '~/css'

import { useMemo } from 'react'
import { pixelAdd } from '~/dom'
import useTwBelt from '~/hooks/useTwBelt'
import { NARROW_HEIGHT_OFFSET } from './constant'
import { getDesktopTransform, getDrawerMinWidth, getDrawerWidth, isWideMode } from './metrics'

type TProps = {
  visible: boolean
  type: string
  rightOffset?: string
  fromContentEdge?: boolean
}

export default ({ visible, type, rightOffset = '0px', fromContentEdge = true }: TProps) => {
  const { cn, bg, br, shadow, zIndex } = useTwBelt()

  const drawerStyle = useMemo(
    () => ({
      transform: getDesktopTransform(visible, fromContentEdge),
      transition: 'transform 850ms cubic-bezier(0.23, 1, 0.32, 1) 0ms',
      // transition: 'transform 5s cubic-bezier(0.23, 1, 0.32, 1) 0ms',
      right: isWideMode(type) ? rightOffset : pixelAdd(rightOffset, 30),
      width: getDrawerWidth(type),
      minWidth: getDrawerMinWidth(type),
      maxWidth: '985px',
      // transitionDelay: '0s, 0s, 0.14s',
      // transitionDelay: '0s, 0s, 0.14s',
    }),
    [visible, fromContentEdge, type, rightOffset],
  )

  return {
    wrapper: cn(
      'fixed top-0 right-0 z-50 flex items-center justify-center w-96 h-screen debug',
      bg('container'),
    ),
    overlay: cn(
      'fixed bottom-0 left-0 overflow-auto h-full w-full',
      visible ? cn('visible opacity-50', bg('drawer.mask')) : 'hidden',
      zIndex('drawerOverlay', visible),
    ),
    overlayStyle: {
      // zIndex: zIndex.drawerOverlay,
      transition: 'visibility 0.1s ease-in, opacity 0.1s ease-in, background 0.1s ease-in',
    },
    drawerContent: cn(
      'relative w-full border rounded-tl-md overflow-y-scroll h-auto',
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
      zIndex('drawer', visible),
    ),
    drawerStyle,
  }
}
