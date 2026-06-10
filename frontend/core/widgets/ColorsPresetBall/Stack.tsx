import useSalon from './salon/stack'
import type { TColorsPresetBallColors } from './spec'

type TProps = {
  colors: TColorsPresetBallColors
}

export default function Stack({ colors }: TProps) {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      {colors.map((color, index) => (
        <span key={`${color}-${index}`} className={s.item} style={{ backgroundColor: color }} />
      ))}
    </div>
  )
}
