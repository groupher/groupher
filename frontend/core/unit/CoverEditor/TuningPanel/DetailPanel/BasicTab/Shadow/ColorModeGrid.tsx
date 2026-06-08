import type { TCoverShadow } from '../../../../spec'
import useLogic from '../../../../useLogic'
import { COLOR_OPTIONS } from './constant'
import useSalon from './salon/color_mode_grid'

type TProps = {
  shadow: TCoverShadow
}

export default function ColorModeGrid({ shadow }: TProps) {
  const s = useSalon()
  const { shadowOnChange } = useLogic()

  return (
    <div className={s.colorRow}>
      {COLOR_OPTIONS.map((option) => {
        const active = shadow.colorMode === option.value

        return (
          <button
            key={option.value}
            type='button'
            className={s.colorButton(active)}
            aria-pressed={active}
            onClick={() => shadowOnChange({ colorMode: option.value })}
          >
            <span className={s.colorSwatch(option.value)} />
            <span className={s.colorLabel}>{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
