import { keys } from 'ramda'

import SIZE from '~/const/size'
import { WALLPAPER_TYPE } from '~/const/wallpaper'
import ColorsPresetBall from '~/widgets/ColorsPresetBall'

import { isActiveWallpaperSource } from '../helper'
import useLogic from '../useLogic'
import PatternCards from './PatternCards'
import useSalon from './salon'

export default function GradientTab() {
  const s = useSalon()
  const { getWallpaper, changeGradientWallpaper, changePatternId } = useLogic()

  const wallpaper = getWallpaper()
  const { gradientPalettes, pattern } = wallpaper

  const gradientKeys = keys(gradientPalettes)

  return (
    <div className={s.wrapper}>
      <div className={s.gradientGrid} style={s.gradientGridStyle}>
        {gradientKeys.map((name) => {
          const palette = gradientPalettes[name]
          const selected = isActiveWallpaperSource(wallpaper, WALLPAPER_TYPE.GRADIENT, name)

          return (
            <ColorsPresetBall
              key={name}
              colors={palette.colors}
              active={selected}
              interactive
              label={palette.label}
              size={SIZE.LARGE}
              onClick={() => {
                if (!selected) changeGradientWallpaper(name)
              }}
            />
          )
        })}
      </div>

      <PatternCards
        patternId={pattern.id}
        wallpaper={wallpaper}
        onPatternSelect={changePatternId}
      />
    </div>
  )
}
