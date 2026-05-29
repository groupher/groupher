import { keys } from 'ramda'

import { WALLPAPER_TYPE } from '~/const/wallpaper'

import { isActiveWallpaperSource } from '../helper'
import useSalon, { cnMerge } from '../salon/gradient_tab'
import useLogic from '../useLogic'
import GradientSwatchPreview from './GradientSwatchPreview'
import PatternCards from './PatternCards'

export default function GradientTab() {
  const s = useSalon()
  const { getWallpaper, changeGradientWallpaper, changePatternId } = useLogic()

  const wallpaper = getWallpaper()
  const { gradientWallpapers, patternId } = wallpaper

  const gradientKeys = keys(gradientWallpapers)

  return (
    <div className={s.wrapper}>
      <div className={s.gradientGrid}>
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
              <GradientSwatchPreview className={s.preview} gradient={presetGradient} />
            </button>
          )
        })}
      </div>

      <PatternCards patternId={patternId} onPatternSelect={changePatternId} />
    </div>
  )
}
