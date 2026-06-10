import SIZE from '~/const/size'
import { WALLPAPER_TYPE } from '~/const/wallpaper'
import type { TBgConfig } from '~/lib/bg'
import ColorsPresetBall, { COLORS_PRESET_BALL_LAYOUT } from '~/widgets/ColorsPresetBall'

import { COVER_GRADIENT_PALETTE } from '../../../background'
import useLogic from '../../../useLogic'
import GroupTitle from '../GroupTitle'
import useSalon from './salon/gradients'

type TProps = {
  background: TBgConfig
}

export default function GradientsSection({ background }: TProps) {
  const s = useSalon()
  const { gradientBackgroundOnChange } = useLogic()

  return (
    <div className={s.section}>
      <GroupTitle>Gradients</GroupTitle>
      <div className={s.gradientGrid}>
        {Object.values(COVER_GRADIENT_PALETTE).map((palette) => {
          const selected =
            background.type === WALLPAPER_TYPE.GRADIENT && background.source === palette.key

          return (
            <ColorsPresetBall
              key={palette.key}
              colors={palette.colors}
              active={selected}
              interactive
              label={palette.label}
              layout={COLORS_PRESET_BALL_LAYOUT.GRID}
              size={SIZE.SMALL}
              onClick={() => {
                if (!selected) {
                  gradientBackgroundOnChange(palette.key)
                }
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
