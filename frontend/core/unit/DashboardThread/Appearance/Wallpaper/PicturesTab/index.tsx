import { keys } from 'ramda'

import { WALLPAPER_TYPE } from '~/const/wallpaper'
import CheckedSVG from '~/icons/CheckBold'
import type { TWallpaperPic } from '~/spec'

import { isActiveWallpaperSource } from '../helper'
import useLogic from '../useLogic'
import useSalon, { cn } from './salon'

export default function PicturesTab() {
  const { getWallpaper, changePatternWallpaper } = useLogic()
  const wallpaper = getWallpaper()
  const { patternWallpapers } = wallpaper

  const s = useSalon()

  const patternKeys = keys(patternWallpapers)

  return (
    <div className={s.wrapper}>
      {patternKeys.map((name) => {
        const { image, preview } = patternWallpapers[name] as TWallpaperPic
        const selected = isActiveWallpaperSource(wallpaper, WALLPAPER_TYPE.PATTERN, name)

        return (
          <button
            type='button'
            className={cn(s.block, selected && s.blockActive)}
            key={name}
            onClick={() => changePatternWallpaper(name)}
          >
            {selected && (
              <div className={s.activeSign}>
                <CheckedSVG className={s.checkIcon} />
              </div>
            )}
            <img className={s.image} src={preview ?? image} alt='' />
          </button>
        )
      })}
    </div>
  )
}
