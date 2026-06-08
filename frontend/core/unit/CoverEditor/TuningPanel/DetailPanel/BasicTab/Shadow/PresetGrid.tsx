import CheckSVG from '~/icons/Check'

import { getImageShadow, normalizeCoverShadow } from '../../../../helper'
import type { TCoverShadow } from '../../../../spec'
import useLogic from '../../../../useLogic'
import { PRESET_OPTIONS, type TShadowPanelStyle } from './constant'
import useSalon from './salon/preset_grid'

type TProps = {
  shadow: TCoverShadow
}

const toPreviewStyle = (shadow: TCoverShadow): TShadowPanelStyle => ({
  '--shadow-preview': getImageShadow(shadow) || 'none',
})

export default function PresetGrid({ shadow }: TProps) {
  const s = useSalon()
  const { shadowOnChange } = useLogic()

  return (
    <div className={s.presetRow}>
      {PRESET_OPTIONS.map((option) => {
        const optionShadow = normalizeCoverShadow({
          ...shadow,
          preset: option.value,
        })
        const active = shadow.preset === option.value

        return (
          <button
            key={option.value}
            type='button'
            className={s.presetButton(active)}
            aria-pressed={active}
            onClick={() => shadowOnChange({ preset: option.value })}
          >
            <span className={s.presetPreview}>
              <span className={s.presetBlock} style={toPreviewStyle(optionShadow)} />
            </span>
            <span className={s.presetLabel(active)}>
              <CheckSVG className={s.presetCheck(active)} />
              <span className={s.presetLabelText}>{option.label}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
