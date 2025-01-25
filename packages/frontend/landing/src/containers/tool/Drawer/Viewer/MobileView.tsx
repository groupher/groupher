import { type FC, type ReactNode, useEffect, useState, memo, useRef } from 'react'

import useSwipe from '~/hooks/useSwipe'

import { ANCHOR } from '~/const/dom'

import type { TSwipeOption } from '../spec'
import Header from '../Header'

import useLogic from '../useLogic'
import useSalon, { cn } from '../salon/mobile_view'

type TProps = {
  testid?: string
  headerText: string
  options: TSwipeOption
  visible: boolean
  type: string
  canBeClose: boolean
  showHeaderText: boolean
  disableContentDrag: boolean
  children: ReactNode
}

const Viewer: FC<TProps> = ({
  testid = 'drawer-sidebar-panel',
  headerText,
  options,
  visible,
  type,
  canBeClose,
  showHeaderText,
  disableContentDrag,
  children,
}) => {
  const [drawerStyle, setDrawerStyle] = useState({})
  const [contentStyle, setContentStyle] = useState({})
  const [innerStyle, setInnerStyle] = useState({})

  const { closeDrawer, onSwipedYHandler, onSwipingYHandler, resetSwipeAviliable } = useLogic()
  // swipe action state for top && bottom
  // null means restore and close
  const [swipeDownY, setSwipeDownY] = useState(null)
  const [swipeUpY, setSwipeUpY] = useState(null)

  const s = useSalon({ visible, type, swipeUpY, swipeDownY, options })

  // force style update
  useEffect(() => {
    setDrawerStyle(s.drawerStyle)
    setContentStyle(s.contentStyle)
    setInnerStyle(s.innerStyle)
  }, [s.drawerStyle, s.contentStyle, s.innerStyle])

  const overlayRef = useRef(null)

  // NOTE: important: reset swipe position when drawer closed
  useEffect(() => {
    // not work
    // if (visible) {
    //   if (overlayRef) {
    //     setTimeout(() => {
    //       overlayRef.current.scrollTo(0, 10)
    //     }, 200)
    //   }
    // }
    if (!visible) {
      setSwipeDownY(null)
      setSwipeUpY(null)
      resetSwipeAviliable()
    }
  }, [visible, overlayRef])

  /**
   * 注意这里有一个坑，在进入 Drawer 滑动到最底部快速往上滑动时
   * CustomScroller 不会阻止 swipe 状态，导致 swipe 状态依然在
   * 记录中，这是松手会导致 Drawer 以外关闭，需要在下层 Content 中
   * 做时间差处理
   */
  const swipeHandlers = useSwipe({
    onSwiped: (ev) => {
      if (disableContentDrag) return false
      onSwipedYHandler(ev, setSwipeUpY, setSwipeDownY)
    },
    onSwiping: (ev) => {
      if (disableContentDrag) return false
      onSwipingYHandler(ev, setSwipeUpY, setSwipeDownY)
    },
  })

  return (
    <>
      <div
        className={cn(s.overlay, ANCHOR.GLOBAL_BLUR_CLASS)}
        onClick={() => closeDrawer()}
        style={s.overlayStyle}
      />

      <div className={s.drawer} style={drawerStyle}>
        <div className={s.content} style={contentStyle}>
          <div className={s.inner} style={innerStyle} {...swipeHandlers}>
            {children}
          </div>
        </div>
        <Header
          headerText={headerText}
          options={options}
          setSwipeDownY={setSwipeDownY}
          setSwipeUpY={setSwipeUpY}
          canBeClose={canBeClose}
          showHeaderText={showHeaderText}
        />
      </div>
    </>
  )
}

export default memo(Viewer)
