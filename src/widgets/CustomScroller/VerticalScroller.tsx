/*
 *
 * VerticalScroller
 *
 */

import { type FC, Fragment, memo } from 'react'

import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'

import SIZE from '~/const/size'
// import useTheme from '~/hooks/useTheme'

// import ViewportTracker from '~/widgets/ViewportTracker'

import type { TProps as TScrollProps } from '.'

import useSalon from './salon/vertical_scroller'

type TProps = Omit<TScrollProps, 'direction' | 'innerHeight'>

// vertical version
const VerticalScroller: FC<TProps> = ({
  height = '100%',
  // width = '100%',
  showShadow = true,
  shadowSize = SIZE.SMALL,
  // barSize = SIZE.SMALL,
  children,
  // autoHide = true,
  // showOnHover = false,
  withBorder = false,
  // onScrollDirectionChange,
  // instanceKey = null,
}) => {
  const s = useSalon()
  // const [showTopShadow] = useState(true)
  // const [showBottomShadow] = useState(true)

  return (
    <Fragment>
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
    </Fragment>
  )
}

export default memo(VerticalScroller)
