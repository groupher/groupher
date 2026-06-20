export { cn } from '~/css'

import { useMemo } from 'react'

import { pixelAdd } from '~/dom'
import useTwBelt from '~/hooks/useTwBelt'

import { CLOSE_ANIMATION_MS, NARROW_HEIGHT_OFFSET } from './constant'
import { getDesktopTransform, getDrawerMinWidth, getDrawerWidth, isWideMode } from './metrics'

type TProps = {
  visible: boolean
  closing?: boolean
  type: string
  rightOffset?: string
  fromContentEdge?: boolean
}

export default function useSalon({
  visible,
  closing = false,
  type,
  rightOffset = '0px',
  fromContentEdge = true,
}: TProps) {
  const { cn, bg, br, shadow, zIndex } = useTwBelt()

  const drawerStyle = useMemo(() => {
    const openTransform = getDesktopTransform(visible, fromContentEdge)

    const closeTransform = 'translate3d(16px, 0, 0) scale(0.985)'
    const isClosingFrame = closing && !visible

    return {
      transform: isClosingFrame ? closeTransform : openTransform,
      opacity: isClosingFrame ? 0 : 1,
      filter: isClosingFrame ? 'blur(2px)' : 'blur(0px)',

      transition: closing
        ? `opacity ${CLOSE_ANIMATION_MS}ms ease, transform ${CLOSE_ANIMATION_MS}ms ease, filter ${CLOSE_ANIMATION_MS}ms ease`
        : 'transform 280ms cubic-bezier(0.23, 1, 0.32, 1) 0ms',

      right: isWideMode(type) ? rightOffset : pixelAdd(rightOffset, 30),
      width: getDrawerWidth(type),
      minWidth: getDrawerMinWidth(type),
      maxWidth: '985px',
    }
  }, [visible, closing, fromContentEdge, type, rightOffset])

  return {
    overlay: cn(
      'fixed bottom-0 left-0 overflow-auto s-full',
      bg('drawer.mask'),
      visible ? 'opacity-50 pointer-events-auto' : 'opacity-0 pointer-events-none',
      zIndex('drawerOverlay', true),
    ),

    overlayStyle: {
      transition: closing ? `opacity ${CLOSE_ANIMATION_MS}ms ease` : 'opacity 250ms ease',
    },

    drawerContent: cn(
      'relative w-full border rounded-tl-md overflow-y-auto h-auto scrollbar-thin scrollbar-thumb-neutral-400 scrollbar-track-transparent dark:scrollbar-thumb-neutral-600',
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
      closing && 'pointer-events-none',
      zIndex('drawer', true),
    ),

    drawerStyle,
  }
}
