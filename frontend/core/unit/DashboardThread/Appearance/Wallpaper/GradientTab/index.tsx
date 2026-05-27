import { keys } from 'ramda'

import CheckedSVG from '~/icons/CheckBold'
import { parseWallpaper } from '~/wallpaper'

import useSalon, { cn } from '../salon/gradient_tab'
import useLogic from '../useLogic'

export default function GradientTab() {
  const s = useSalon()
  const { getWallpaper, changeGradientWallpaper } = useLogic()

  const { source, gradientWallpapers } = getWallpaper()

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
    </div>
  )
}
