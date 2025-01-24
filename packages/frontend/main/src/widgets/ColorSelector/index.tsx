/*
 *
 * ColorSelector
 *
 */

import type { FC, ReactNode } from 'react'
import { keys, includes, isEmpty, endsWith } from 'ramda'

import type { TColorName, TTooltipPlacement } from '~/spec'

import { COLOR_NAME } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

import HookSVG from '~/icons/Hook'
import Tooltip from '~/widgets/Tooltip'

import useSalon, { cn } from './salon'

type TProps = {
  activeColor?: TColorName | string
  testid?: string
  children: ReactNode
  onChange?: (color: TColorName) => void
  placement?: TTooltipPlacement
  offset?: [number, number]
  bgMode?: boolean
  excepts?: TColorName[]
}

const ColorSelector: FC<TProps> = ({
  testid = 'color-selector',
  activeColor,
  children,
  onChange = console.log,
  placement = 'bottom',
  offset = [5, 5],
  bgMode = false,
  excepts = [],
}) => {
  const colorKeys = isEmpty(excepts)
    ? keys(COLOR_NAME)
    : keys(COLOR_NAME).filter((k) => !includes(k, excepts))

  const s = useSalon()
  const { rainbow } = useTwBelt()

  return (
    <Tooltip
      placement={placement}
      trigger="click"
      hideOnClick={false}
      offset={offset}
      content={
        <div className={s.wrapper} data-testid={testid}>
          {colorKeys.map((color) => {
            const selected = color === activeColor

            if (endsWith('_LIGHT', color)) return null

            return (
              <div key={color} className={s.dotWrapper} onClick={() => onChange(color)}>
                <div className={cn(s.dot, selected && s.dotActive, rainbow(color, 'bg'))}>
                  {selected && <HookSVG className={s.checkIcon} />}
                </div>
              </div>
            )
          })}
        </div>
      }
    >
      {children}
    </Tooltip>
  )
}

export default ColorSelector
