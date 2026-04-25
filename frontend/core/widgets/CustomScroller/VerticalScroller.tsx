/*
 *
 * VerticalScroller
 *
 */

import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import { type FC, memo } from 'react'

import SIZE from '~/const/size'
// import useTheme from '~/hooks/useTheme'

// import ViewportTracker from '~/widgets/ViewportTracker'

import type { TProps as TScrollProps } from '.'

import useSalon from './salon/vertical_scroller'

type TProps = Omit<TScrollProps, 'direction' | 'innerHeight'>

// vertical version
const VerticalScroller: FC<TProps> = ({
  _height = '100%',
  // width = '100%',
  _showShadow = true,
  _shadowSize = SIZE.SMALL,
  // barSize = SIZE.SMALL,
  children,
  // autoHide = true,
  // showOnHover = false,
  _withBorder = false,
  // onScrollDirectionChange,
  // instanceKey = null,
}) => {
  const s = useSalon()
  // const [showTopShadow] = useState(true)
  // const [showBottomShadow] = useState(true)

  return (
    <OverlayScrollbarsComponent
      options={{
        scrollbars: { autoHide: 'leave', autoHideDelay: 300, autoHideSuspend: true },
      }}
    >
      <div className={s.viewHolder} />
      {/* <Waypoint onEnter={handleHideTopShadow} onLeave={handleShowTopShadow} /> */}
      {children}

      <div className={s.viewHolder} />
      {/* <Waypoint onEnter={handleHideBottomShadow} onLeave={handleShowBottomShadow} /> */}
    </OverlayScrollbarsComponent>
  )
}

export default memo(VerticalScroller)
