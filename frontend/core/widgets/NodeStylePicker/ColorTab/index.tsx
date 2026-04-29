'use client'

import { type FC } from 'react'

import { COLOR } from '~/const/colors'
import { NODE_STYLE } from '~/const/node_style'
import HookSVG from '~/icons/Hook'
import type { TColorName, TNodeStyleValue } from '~/spec'

import useSalon from '../salon'

type TProps = {
  selectedValue: TNodeStyleValue
  onChange: (value: TNodeStyleValue) => void
}

const COLOR_ITEMS = Object.values(COLOR).filter((color) => color !== COLOR.CUSTOM) as TColorName[]

const ColorTab: FC<TProps> = ({ selectedValue, onChange }) => {
  const s = useSalon()

  return (
    <div className={s.colorGrid}>
      {COLOR_ITEMS.map((color) => {
        const active = selectedValue.type === NODE_STYLE.COLOR && selectedValue.color === color

        return (
          <button
            key={color}
            type='button'
            aria-label={color}
            aria-pressed={active}
            className={`${s.colorButton} ${active ? s.colorButtonActive : ''}`}
            onClick={() => onChange({ type: NODE_STYLE.COLOR, color })}
          >
            <span className={s.colorDot(color, active)}>
              {active && <HookSVG className={s.colorCheckIcon} />}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default ColorTab
