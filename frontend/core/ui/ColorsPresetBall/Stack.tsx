import useSalon from './salon/stack'
import type { TColorsPresetBallColors } from './spec'

type TProps = {
  colors: TColorsPresetBallColors
}

export default function Stack({ colors }: TProps) {
  const s = useSalon()
  const colorOccurrences = new Map<string, number>()

  return (
    <div className={s.wrapper}>
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
