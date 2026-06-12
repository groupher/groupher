import SIZE from '~/const/size'
import { WALLPAPER_TYPE } from '~/const/wallpaper'
import CheckedSVG from '~/icons/CheckBold'
import type { TBgConfig } from '~/lib/bg'
import ColorsPresetBall, { COLORS_PRESET_BALL_LAYOUT } from '~/widgets/ColorsPresetBall'

import { COVER_GRADIENT_PALETTE } from '../../../background'
import useLogic from '../../../useLogic'
import GroupTitle from '../GroupTitle'
import useSalon from './salon/gradients'

type TProps = {
  background: TBgConfig
}

export default function Gradients({ background }: TProps) {
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
            <button
              type='button'
              key={palette.key}
              aria-label={palette.label}
              aria-pressed={selected}
              className={s.button(selected)}
              onClick={() => {
                if (!selected) {
                  gradientBackgroundOnChange(palette.key)
                }
              }}
            >
              {selected && (
                <span className={s.activeSign}>
                  <CheckedSVG className={s.checkIcon} />
                </span>
              )}

              <span className={s.content}>
                <ColorsPresetBall
                  colors={palette.colors}
                  label={palette.label}
                  layout={COLORS_PRESET_BALL_LAYOUT.GRID}
                  size={SIZE.MEDIUM}
                />
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
