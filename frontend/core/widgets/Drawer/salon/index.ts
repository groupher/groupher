export { cn } from '~/css'

import { useMemo } from 'react'

import { pixelAdd } from '~/dom'
import usePageBg from '~/hooks/usePageBg'
import useTwBelt from '~/hooks/useTwBelt'

import { CLOSE_ANIMATION_MS, NARROW_HEIGHT_OFFSET } from './constant'
import { getDesktopTransform, getDrawerMinWidth, getDrawerWidth, isWideMode } from './metrics'

type TProps = {
  visible: boolean
  closing?: boolean
  type: string
  rightOffset?: string
  fromContentEdge?: boolean
  wide?: boolean
}

export default function useSalon({
  visible,
  closing = false,
  type,
  rightOffset = '0px',
  fromContentEdge = true,
  wide,
}: TProps) {
  const { cn, bg, br, page, shadow, scrollbar, zIndex } = useTwBelt()
  const { background } = usePageBg()
  const wideMode = wide ?? isWideMode(type)

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
        : 'transform 280ms cubic-bezier(0.23, 1, 0.32, 1), width 280ms cubic-bezier(0.23, 1, 0.32, 1), min-width 280ms cubic-bezier(0.23, 1, 0.32, 1), right 280ms cubic-bezier(0.23, 1, 0.32, 1)',

      right: wideMode ? rightOffset : pixelAdd(rightOffset, 30),
      width: getDrawerWidth(type, wideMode),
      minWidth: getDrawerMinWidth(type, wideMode),
      maxWidth: '985px',
    }
  }, [visible, closing, fromContentEdge, type, rightOffset, wideMode])

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
      'relative w-full border rounded-tl-md overflow-y-auto h-auto',
      scrollbar('thin'),
      br('divider'),
      bg('pageBg'),
      page(),
      !wideMode && 'rounded-md',
      shadow('drawer'),
    ),

    drawerContentStyle: {
      backgroundColor: `var(--preview-page-bg, ${background})`,
      height: wideMode ? '100vh' : `calc(100vh - ${NARROW_HEIGHT_OFFSET * 2}px)`,
      transition: 'height 280ms cubic-bezier(0.23, 1, 0.32, 1)',
    },

    drawer: cn(
      'fixed row h-full will-change-transform box-border',
      wideMode ? 'top-0' : 'top-5',
      closing && 'pointer-events-none',
      zIndex('drawer', true),
    ),

    drawerStyle,
  }
}
