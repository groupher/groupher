import { keys } from 'ramda'

import { WALLPAPER_TYPE } from '~/const/wallpaper'
import CheckedSVG from '~/icons/CheckBold'
import PenSVG from '~/icons/EditPen'
import { parseWallpaper } from '~/wallpaper'

import useSalon, { cn } from '../salon/build_in/gradient_group'
import useLogic from '../useLogic'

export default function GradientGroup() {
  const s = useSalon()
  const { getWallpaper, changeGradientWallpaper, changeCustomGradientWallpaper } = useLogic()

  const { source, type, gradientWallpapers } = getWallpaper()

  const gradientKeys = keys(gradientWallpapers)

  return (
    <div className={s.wrapper}>
      {gradientKeys.map((name) => (
        <button
          type='button'
          key={name}
          className={cn(s.card, name === source && s.cardActive)}
          onClick={() => changeGradientWallpaper(name)}
        >
          {name === source && (
            <div className={s.activeSign}>
              <CheckedSVG className={s.checkIcon} />
            </div>
          )}
          <div
            className={s.preview}
            style={{ background: parseWallpaper(gradientWallpapers, name).background }}
          />
        </button>
      ))}
      <button
        type='button'
        className={cn(s.card, type === WALLPAPER_TYPE.CUSTOM_GRADIENT && s.cardActive)}
        onClick={() => changeCustomGradientWallpaper()}
      >
        {type === WALLPAPER_TYPE.CUSTOM_GRADIENT && (
          <div className={s.activeSign}>
            <CheckedSVG className={s.checkIcon} />
          </div>
        )}
        <div
          className={cn(s.preview, 'align-both')}
          style={{
            background:
              'conic-gradient(rgb(235, 87, 87),rgb(78, 167, 252),rgb(76, 183, 130),rgb(242, 201, 76),rgb(250, 96, 122))',
          }}
        >
          <div className={s.penWrapper}>
            <PenSVG className={s.penIcon} />
          </div>
        </div>
      </button>
    </div>
  )
}
