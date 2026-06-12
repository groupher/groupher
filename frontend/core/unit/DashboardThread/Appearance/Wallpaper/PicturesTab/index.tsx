import { keys } from 'ramda'

import { WALLPAPER_TYPE } from '~/const/wallpaper'
import type { TWallpaperPic } from '~/spec'
import SelectableCard from '~/widgets/SelectableCard'

import { isActiveWallpaperSource } from '../helper'
import useLogic from '../useLogic'
import useSalon from './salon'

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
          <SelectableCard
            key={name}
            active={selected}
            ariaLabel={name}
            className={s.block}
            onClick={() => changePatternWallpaper(name)}
          >
            <img className={s.image} src={preview ?? image} alt='' />
          </SelectableCard>
        )
      })}
    </div>
  )
}
