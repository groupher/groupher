import type { FC } from 'react'

import useSwipe from '~/hooks/useSwipe'
import { nilOrEmpty } from '~/validator'

import CloseButtonSVG from '~/icons/CloseLight'

import type { TSwipeOption } from '../spec'
// import CloseLine from './CloseLine'
import useLogic from '../useLogic'
import useSalon, { cn } from '../styles/header'

type TProps = {
  headerText?: string
  options: TSwipeOption
  setSwipeUpY: (i: number) => void
  setSwipeDownY: (i: number) => void
  canBeClose: boolean
  showHeaderText: boolean
}

const Header: FC<TProps> = ({
  headerText,
  options,
  setSwipeUpY,
  setSwipeDownY,
  canBeClose,
  showHeaderText,
}) => {
  const s = useSalon()

  const { closeDrawer, onSwipedYHandler, onSwipingYHandler } = useLogic()
  const ignoreSwipeAviliable = true
  const swipeHandlers = useSwipe({
    onSwiped: (ev) => onSwipedYHandler(ev, setSwipeUpY, setSwipeDownY, ignoreSwipeAviliable),
    onSwiping: (ev) => onSwipingYHandler(ev, setSwipeUpY, setSwipeDownY, ignoreSwipeAviliable),
  })

  const content = showHeaderText && !nilOrEmpty(headerText) && (
    <div className={s.textWrapper}>{headerText}</div>
  )
  // <CloseLine curve={!canBeClose} />

  if (options.direction === 'bottom') {
    return (
      <div className={cn(s.wrapper, s.bottomWrapper)} {...swipeHandlers}>
        {content}
        <CloseButtonSVG className={s.closeButton} onClick={() => closeDrawer()} />
      </div>
    )
  }
  return (
    <div className={cn(s.wrapper, s.topWrapper)} {...swipeHandlers}>
      {content}
    </div>
  )
}

export default Header
