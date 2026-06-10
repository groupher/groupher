import type { ReactNode } from 'react'

import SIZE from '~/const/size'
import type { TColorName } from '~/spec'
import ColorSelector from '~/widgets/ColorSelector'
import ColorsPresetBall from '~/widgets/ColorsPresetBall'

import useSalon from './salon/colors_field'

type TColorChip = {
  color: string
  activeColor: TColorName
  key: string
  label: string
  onChange: (color: TColorName) => void
  onCustomColorChange: (color: string) => void
}

type Props = {
  label: ReactNode
  chips: TColorChip[]
}

export default function ColorsField({ label, chips }: Props) {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.label}>{label}</div>
      <div className={s.content}>
        <div className={s.chips}>
          {chips.map(({ color, activeColor, key, label, onChange, onCustomColorChange }) => (
            <ColorSelector
              key={key}
              activeColor={activeColor}
              customColor={color}
              allowCustomColor
              placement='top'
              onChange={onChange}
              onCustomColorChange={onCustomColorChange}
            >
              <ColorsPresetBall colors={[color]} interactive label={label} size={SIZE.SMALL} />
            </ColorSelector>
          ))}
        </div>
      </div>
    </div>
  )
}
