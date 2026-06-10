import type { CSSProperties } from 'react'

import SIZE from '~/const/size'
import { cnMerge } from '~/css'

import { COLOR_PRESET_BALL_FALLBACK_COLOR, COLORS_PRESET_BALL_LAYOUT } from './constant'
import Grid from './Grid'
import useSalon from './salon'
import type {
  TColorsPresetBallColors,
  TColorsPresetBallLayout,
  TColorsPresetBallSize,
} from './spec'
import Stack from './Stack'

export { COLORS_PRESET_BALL_LAYOUT } from './constant'

type TProps = {
  colors: TColorsPresetBallColors
  layout?: TColorsPresetBallLayout
  size?: TColorsPresetBallSize
  className?: string
  label?: string
  interactive?: boolean
  active?: boolean
  onClick?: () => void
}

export default function ColorsPresetBall({
  colors,
  layout = COLORS_PRESET_BALL_LAYOUT.STACK,
  size = SIZE.MEDIUM,
  className,
  label,
  interactive = false,
  active = false,
  onClick,
}: TProps) {
  const safeColors = colors.length > 0 ? colors : [COLOR_PRESET_BALL_FALLBACK_COLOR]
  const isNumericSize = typeof size === 'number'
  const containerStyle: CSSProperties | undefined = isNumericSize
    ? { width: size, height: size }
    : undefined
  const s = useSalon({ size, isNumericSize, interactive, active })
  const content =
    layout === COLORS_PRESET_BALL_LAYOUT.GRID ? (
      <Grid colors={safeColors} />
    ) : (
      <Stack colors={safeColors} />
    )

  if (interactive) {
    return (
      <button
        type='button'
        className={cnMerge(s.wrapper, className)}
        style={containerStyle}
        aria-label={label}
        aria-pressed={active}
        title={label}
        onClick={onClick}
      >
        {content}
      </button>
    )
  }

  return (
    <div
      className={cnMerge(s.wrapper, className)}
      style={containerStyle}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {content}
    </div>
  )
}
