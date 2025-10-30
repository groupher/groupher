import { useMemo } from 'react'
import useTwBelt from '~/hooks/useTwBelt'
import { NARROW_HEIGHT_OFFSET } from '../constant'
import type { TSwipeOption } from '../spec'
import {
  getContentLinearGradient,
  getDim,
  getDrawerMinWidth,
  getDrawerWidth,
  getMobileContentHeight,
  getMobileTransform,
  isWideMode,
} from './metrics'

export { cn } from '~/css'

type TProps = {
  visible: boolean
  type: string
  swipeUpY: number
  swipeDownY: number
  options: TSwipeOption
}

export default ({ visible, type, swipeUpY, swipeDownY, options }: TProps) => {
  const { cn, bg, br, shadow, zIndex } = useTwBelt()

  const drawerStyle = useMemo(
    () => ({
      transform: getMobileTransform(visible, swipeUpY, swipeDownY, options),
      transition: 'transform 850ms cubic-bezier(0.23, 1, 0.32, 1) 0ms',
      width: getDrawerWidth(type),
      minWidth: getDrawerMinWidth(type),
      // zIndex: visible ? zIndex.drawer : -1,
      maxWidth: '985px',
      transitionDelay: '0s, 0s, 0.14s',
    }),
    [visible, type, swipeUpY, swipeDownY, options],
  )

  const contentStyle = useMemo(
    () => ({
      height: getMobileContentHeight(options),
      background: getContentLinearGradient(options, 'white'),
    }),
    [options],
  )

  const innerStyle = useMemo(
    () => ({
      filter: getDim(swipeUpY, swipeDownY, options),
    }),
    [swipeUpY, swipeDownY, options],
  )

  return {
    overlay: cn(
      'fixed bottom-0 left-0 right-0 overflow-auto h-full w-full',
      visible ? cn('visible opacity-50', bg('drawer.mask')) : 'hidden',
      zIndex('drawerOverlay'),
    ),

    overlayStyle: {
      // zIndex: zIndex.drawerOverlay,
      transition: 'visibility 0.1s ease-in, opacity 0.1s ease-in, background 0.1s ease-in',
    },

    naviArea: 'absolute left-0 z-20 w-12 h-5/6 top-20',
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
      'fixed roww-full min-w-full overflow-auto h-auto will-change-transform box-border border',
      br('divider'),
      isWideMode(type) ? 'top-0' : 'top-6',
      visible ? 'visible' : 'hidden',
      zIndex('drawer', visible),
    ),

    drawerStyle,
    //
    content: cn('w-full'),
    contentStyle,
    inner: cn(
      'w-full overflow-y-auto trans-all-200 hax-h-5/6',
      shadow('xl'),
      options.direction === 'bottom' && 'mt-4',
    ),
    innerStyle,
  }
}
