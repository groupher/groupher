import { GRADIENT_DIRECTION } from '~/const/wallpaper'
import ArrowSVG from '~/icons/ArrowSolid'
import { createKeyboardClick } from '~/lib/a11y'

import useSalon, { cn } from '../salon/build_in/angle_panel'
import useLogic from '../useLogic'

export default function AnglePanel() {
  const { getWallpaper, changeDirection } = useLogic()
  const { direction } = getWallpaper()

  const s = useSalon({ direction })

  const { TOP, TOP_LEFT, TOP_RIGHT, LEFT, RIGHT, BOTTOM, BOTTOM_LEFT, BOTTOM_RIGHT } =
    GRADIENT_DIRECTION

  return (
    <div className={s.wrapper}>
      <div
        className={cn(s.point, s.top, direction === TOP && s.pointActive)}
        role='button'
        tabIndex={0}
        onClick={() => changeDirection(TOP)}
        onKeyDown={createKeyboardClick(() => changeDirection(TOP))}
      >
        <ArrowSVG
          className={cn(s.arrowIcon, direction === TOP && s.arrowActive)}
          style={{ transform: 'rotate(-90deg)' }}
        />
      </div>
      <div
        className={cn(s.point, s.sidePoint, s.topLeft, direction === TOP_LEFT && s.pointActive)}
        role='button'
        tabIndex={0}
        onClick={() => changeDirection(TOP_LEFT)}
        onKeyDown={createKeyboardClick(() => changeDirection(TOP_LEFT))}
      >
        <ArrowSVG
          className={cn(s.arrowIcon, direction === TOP_LEFT && s.arrowActive)}
          style={{ transform: 'rotate(-135deg)' }}
        />
      </div>
      <div
        className={cn(s.point, s.sidePoint, s.topRight, direction === TOP_RIGHT && s.pointActive)}
        role='button'
        tabIndex={0}
        onClick={() => changeDirection(TOP_RIGHT)}
        onKeyDown={createKeyboardClick(() => changeDirection(TOP_RIGHT))}
      >
        <ArrowSVG
          className={cn(s.arrowIcon, direction === TOP_RIGHT && s.arrowActive)}
          style={{ transform: 'rotate(-45deg)' }}
        />
      </div>
      <div
        className={cn(s.point, s.bottom, direction === BOTTOM && s.pointActive)}
        role='button'
        tabIndex={0}
        onClick={() => changeDirection(BOTTOM)}
        onKeyDown={createKeyboardClick(() => changeDirection(BOTTOM))}
      >
        <ArrowSVG
          className={cn(s.arrowIcon, direction === BOTTOM && s.arrowActive)}
          style={{ transform: 'rotate(90deg)' }}
        />
      </div>

      <div
        className={cn(
          s.point,
          s.sidePoint,
          s.bottomLeft,
          direction === BOTTOM_LEFT && s.pointActive,
        )}
        role='button'
        tabIndex={0}
        onClick={() => changeDirection(BOTTOM_LEFT)}
        onKeyDown={createKeyboardClick(() => changeDirection(BOTTOM_LEFT))}
      >
        <ArrowSVG
          className={cn(s.arrowIcon, direction === BOTTOM_LEFT && s.arrowActive)}
          style={{ transform: 'rotate(135deg)' }}
        />
      </div>

      <div
        className={cn(
          s.point,
          s.sidePoint,
          s.bottomRight,
          direction === BOTTOM_RIGHT && s.pointActive,
        )}
        role='button'
        tabIndex={0}
        onClick={() => changeDirection(BOTTOM_RIGHT)}
        onKeyDown={createKeyboardClick(() => changeDirection(BOTTOM_RIGHT))}
      >
        <ArrowSVG
          className={cn(s.arrowIcon, direction === BOTTOM_RIGHT && s.arrowActive)}
          style={{ transform: 'rotate(42deg)' }}
        />
      </div>

      <div
        className={cn(s.point, s.left, direction === LEFT && s.pointActive)}
        role='button'
        tabIndex={0}
        onClick={() => changeDirection(LEFT)}
        onKeyDown={createKeyboardClick(() => changeDirection(LEFT))}
      >
        <ArrowSVG
          className={cn(s.arrowIcon, direction === LEFT && s.arrowActive)}
          style={{ transform: 'rotate(-180deg)' }}
        />
      </div>
      <div
        className={cn(s.point, s.right, direction === RIGHT && s.pointActive)}
        role='button'
        tabIndex={0}
        onClick={() => changeDirection(RIGHT)}
        onKeyDown={createKeyboardClick(() => changeDirection(RIGHT))}
      >
        <ArrowSVG className={cn(s.arrowIcon, direction === RIGHT && s.arrowActive)} />
      </div>
      <div className={s.needleDot} />
      <div className={s.needle} style={s.needleStyle} />
    </div>
  )
}
