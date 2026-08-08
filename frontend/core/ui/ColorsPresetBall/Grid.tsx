import type { CSSProperties } from 'react'

import { getGridColumns, getGridRows } from './helper'
import useSalon from './salon/grid'
import type { TColorsPresetBallColors } from './spec'

type TProps = {
  colors: TColorsPresetBallColors
}

export default function Grid({ colors }: TProps) {
  const s = useSalon()
  const colorOccurrences = new Map<string, number>()
  const style: CSSProperties = {
    gridTemplateColumns: `repeat(${getGridColumns(colors.length)}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${getGridRows(colors.length)}, minmax(0, 1fr))`,
  }

  return (
    <div className={s.wrapper} style={style}>
      {colors.map((color) => {
        const occurrence = (colorOccurrences.get(color) ?? 0) + 1
        colorOccurrences.set(color, occurrence)

        return (
          <span
            key={`${color}-${occurrence}`}
            className={s.item}
            style={{ backgroundColor: color }}
          />
        )
      })}
    </div>
  )
}
