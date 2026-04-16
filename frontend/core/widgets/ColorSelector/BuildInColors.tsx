/*
 *
 * ColorSelector
 *
 */

import { endsWith, includes, isEmpty, keys } from 'ramda'
import type { FC } from 'react'
import { COLOR, STACKED_COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'
import ArrowSVG from '~/icons/ArrowSimple'
import HookSVG from '~/icons/Hook'
import type { TColorName } from '~/spec'

import useSalon, { cn } from './salon/buildin_colors'

type TProps = {
  activeColor?: TColorName | string
  onChange?: (color: TColorName) => void
  excepts?: TColorName[]
}

const BuildInColors: FC<TProps> = ({ activeColor, onChange = console.log, excepts = [] }) => {
  const stacked = false

  const DISPLAY_COLOR = stacked ? STACKED_COLOR : COLOR
  const colorKeys = isEmpty(excepts)
    ? keys(DISPLAY_COLOR)
    : keys(DISPLAY_COLOR).filter((k) => !includes(k, excepts))

  const s = useSalon({ stacked })
  const { rainbow } = useTwBelt()

  return (
    <div className={s.wrapper}>
      {stacked && <ArrowSVG className={s.backIcon} />}
      {colorKeys.map((color) => {
        const selected = color === activeColor

        // @ts-expect-error
        if (endsWith('_LIGHT', color) || color === COLOR.CUSTOM) return null

        return (
          <button
            key={color}
            className={s.dotWrapper}
            onClick={() => {
              if (stacked) return

              onChange(color)
            }}
          >
            <div className={cn(s.dot, selected && s.dotActive, rainbow(color, 'bg'))}>
              {selected && <HookSVG className={s.checkIcon} />}
            </div>
          </button>
        )
      })}
    </div>
  )
}

export default BuildInColors
