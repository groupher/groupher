import { Radio, RadioGroup } from 'react-aria-components'

import type { TCoverShadow, TCoverShadowColorMode } from '../../../../spec'
import useLogic from '../../../../useLogic'
import { COLOR_OPTIONS } from './constant'
import useSalon, { cn } from './salon/color_mode_grid'

type TProps = {
  shadow: TCoverShadow
}

export default function ColorModeGrid({ shadow }: TProps) {
  const s = useSalon()
  const { shadowOnChange } = useLogic()

  return (
    <RadioGroup
      aria-label='Shadow color mode'
      className={s.colorRow}
      value={shadow.colorMode}
      onChange={(nextValue) => shadowOnChange({ colorMode: nextValue as TCoverShadowColorMode })}
    >
      {COLOR_OPTIONS.map((option) => (
        <Radio key={option.value} className={s.colorOption} value={option.value}>
          {({ isSelected }) => (
            <>
              <span className={cn(s.colorRadio, isSelected && s.colorRadioActive)} />
              <span className={s.colorOptionLabel}>{option.label}</span>
            </>
          )}
        </Radio>
      ))}
    </RadioGroup>
  )
}
