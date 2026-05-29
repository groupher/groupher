import { keys } from 'ramda'

import { WALLPAPER_TYPE } from '~/const/wallpaper'
import { buildGradientBackground } from '~/lib/wallpaperMesh'

import { isActiveWallpaperSource } from '../helper'
import useSalon, { cnMerge } from '../salon/gradient_tab'
import useLogic from '../useLogic'

export default function GradientTab() {
  const s = useSalon()
  const { getWallpaper, changeGradientWallpaper } = useLogic()

  const wallpaper = getWallpaper()
  const { gradientWallpapers } = wallpaper

  const gradientKeys = keys(gradientWallpapers)

  return (
    <div className={s.wrapper}>
      {gradientKeys.map((name) => {
        const presetGradient = gradientWallpapers[name]
        const selected = isActiveWallpaperSource(wallpaper, WALLPAPER_TYPE.GRADIENT, name)

        return (
          <button
            type='button'
            key={name}
            className={cnMerge(s.card, selected && s.cardActive)}
            onClick={() => changeGradientWallpaper(name)}
          >
            <div
              className={s.preview}
              style={{ background: buildGradientBackground(presetGradient) }}
            />
          </button>
        )
      })}
    </div>
  )
}
