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
  const { gradientPalettes, patternId } = wallpaper

  const gradientKeys = keys(gradientPalettes)

  return (
    <div className={s.wrapper}>
      <div className={s.gradientGrid}>
        {gradientKeys.map((name) => {
          const palette = gradientPalettes[name]
          const selected = isActiveWallpaperSource(wallpaper, WALLPAPER_TYPE.GRADIENT, name)

          return (
            <button
              type='button'
              key={name}
              className={cnMerge(s.card, selected && s.cardActive)}
              aria-label={palette.label}
              title={palette.label}
              onClick={() => {
                if (!selected) changeGradientWallpaper(name)
              }}
            >
              <GradientSwatchPreview className={s.preview} palette={palette} />
            </button>
          )
        })}
      </div>

      <PatternCards patternId={patternId} wallpaper={wallpaper} onPatternSelect={changePatternId} />
    </div>
  )
}
