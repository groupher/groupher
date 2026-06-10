import type { CSSProperties } from 'react'

import { getGridColumns, getGridRows } from './helper'
import useSalon from './salon/grid'
import type { TColorsPresetBallColors } from './spec'

type TProps = {
  colors: TColorsPresetBallColors
}

export default function Grid({ colors }: TProps) {
  const s = useSalon()
  const style: CSSProperties = {
    gridTemplateColumns: `repeat(${getGridColumns(colors.length)}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${getGridRows(colors.length)}, minmax(0, 1fr))`,
  }

  return (
    <div className={s.wrapper} style={style}>
      {colors.map((color, index) => (
        <span key={`${color}-${index}`} className={s.item} style={{ backgroundColor: color }} />
      ))}
    </div>
  )
}
