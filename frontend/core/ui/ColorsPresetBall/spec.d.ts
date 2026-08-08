import type { TSizeL, TSizeM, TSizeS, TSizeT } from '~/spec'

import type { COLORS_PRESET_BALL_LAYOUT } from './constant'

export type TColorsPresetBallLayout =
  (typeof COLORS_PRESET_BALL_LAYOUT)[keyof typeof COLORS_PRESET_BALL_LAYOUT]

export type TColorsPresetBallSize = TSizeT | TSizeS | TSizeM | TSizeL | 'full' | number

export type TColorsPresetBallColors = string[]
