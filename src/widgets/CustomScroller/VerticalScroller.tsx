/*
 *
 * VerticalScroller
 *
 */

import { type FC, useState, Fragment, memo } from 'react'

// NOTE: do not use ViewportTracker here, it cause crash
// import { Waypoint } from 'react-waypoint'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'

import SIZE from '~/const/size'
// import useTheme from '~/hooks/useTheme'

// import ViewportTracker from '~/widgets/ViewportTracker'

import type { TProps as TScrollProps } from '.'

import {
  ViewHolder,
  //
  TopShadowBar,
  BottomShadowBar,
} from './styles/vertical_scroller'

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
  const [showTopShadow] = useState(true)
  const [showBottomShadow] = useState(true)

  // record last y position after scroll
  // to judge is scroll up or down
  // 记录上一次距离顶部的 y 轴位置，用于计算当前滑动是向上还是向下
  // const [lastYPosition, setLastYPosition] = useState(0)

  // @ts-ignore
  // const { themeMap } = useTheme()
  // const { category: themeCategory } = themeMeta

  //   <Wrapper
  //   height={height}
  //   width={width}
  //   $shadowSize={shadowSize}
  //   $barSize={barSize}
  //   $showOnHover={showOnHover}
  // >
  return (
    <Fragment>
      {showShadow && (
        <TopShadowBar
          show={showTopShadow}
          height={height}
          $shadowSize={shadowSize}
          withBorder={withBorder}
        />
      )}

      <OverlayScrollbarsComponent
        options={{
          scrollbars: { autoHide: 'leave', autoHideDelay: 300, autoHideSuspend: true },
        }}
      >
        <ViewHolder />
        {/* <Waypoint onEnter={handleHideTopShadow} onLeave={handleShowTopShadow} /> */}
        {children}
        <ViewHolder />
        {/* <Waypoint onEnter={handleHideBottomShadow} onLeave={handleShowBottomShadow} /> */}
      </OverlayScrollbarsComponent>

      {showShadow && (
        <BottomShadowBar
          show={showBottomShadow}
          height={height}
          $shadowSize={shadowSize}
          withBorder={withBorder}
        />
      )}
    </Fragment>
  )
}

export default memo(VerticalScroller)
