import { keys } from 'ramda'

import { WALLPAPER_TYPE } from '~/const/wallpaper'
import PenSVG from '~/icons/EditPen'
import { createKeyboardClick } from '~/lib/a11y'
import { parseWallpaper } from '~/wallpaper'

import useSalon, { cn } from '../salon/build_in/gradient_group'
import useLogic from '../useLogic'

export default function GradientGroup() {
  const s = useSalon()
  const { getWallpaper, changeGradientWallpaper, changeCustomGradientWallpaper } = useLogic()

  const { wallpaper, gradientWallpapers } = getWallpaper()

  const gradientKeys = keys(gradientWallpapers)

  return (
    <div className={s.wrapper}>
      {gradientKeys.map((name) => (
        <div
          key={name}
          className={cn(s.ballWrapper, name === wallpaper && s.ballActive)}
          role='button'
          tabIndex={0}
          onClick={() => changeGradientWallpaper(name)}
          onKeyDown={createKeyboardClick(() => changeGradientWallpaper(name))}
        >
          <div
            className={s.colorBall}
            style={{ background: parseWallpaper(gradientWallpapers, name).background }}
          />
        </div>
      ))}
      <div
        className={cn(s.ballWrapper, wallpaper === WALLPAPER_TYPE.CUSTOM_GRADIENT && s.ballActive)}
        role='button'
        tabIndex={0}
        onClick={() => changeCustomGradientWallpaper()}
        onKeyDown={createKeyboardClick(() => changeCustomGradientWallpaper())}
      >
        <div
          className={cn(s.colorBall, 'align-both')}
          style={{
            background:
              'conic-gradient(rgb(235, 87, 87),rgb(78, 167, 252),rgb(76, 183, 130),rgb(242, 201, 76),rgb(250, 96, 122))',
          }}
        >
          <div className={s.penWrapper}>
            <PenSVG className={s.penIcon} />
          </div>
        </div>
      </div>
    </div>
  )
}
