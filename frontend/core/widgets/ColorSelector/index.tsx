/*
 *
 * ColorSelector
 *
 */

import { endsWith, includes, isEmpty, keys } from 'ramda'
import type { FC, ReactNode } from 'react'
import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'
import HookSVG from '~/icons/Hook'
import type { TColorName, TTooltipPlacement } from '~/spec'
import Tooltip from '~/widgets/Tooltip'
import CustomColor from './CustomColor'

import useSalon, { cn } from './salon'

type TProps = {
  activeColor?: TColorName | string
  testid?: string
  children: ReactNode
  onChange?: (color: TColorName) => void
  placement?: TTooltipPlacement
  offset?: [number, number]
  excepts?: TColorName[]
}

const ColorSelector: FC<TProps> = ({
  testid = 'color-selector',
  activeColor,
  children,
  onChange = console.log,
  placement = 'bottom',
  offset = [5, 5],
  excepts = [],
}) => {
  const colorKeys = isEmpty(excepts)
    ? keys(COLOR)
    : keys(COLOR).filter((k) => !includes(k, excepts))

  const s = useSalon()
  const { rainbow } = useTwBelt()

  return (
    <Tooltip
      placement={placement}
      trigger='click'
      hideOnClick={false}
      maxWidth='none'
      offset={offset}
      content={
        <div data-testid={testid}>
          <div className={s.wrapper}>
            {colorKeys.map((color) => {
              const selected = color === activeColor

              if (endsWith('_LIGHT', color) || color === COLOR.CUSTOM) return null

              return (
                <button key={color} className={s.dotWrapper} onClick={() => onChange(color)}>
                  <div className={cn(s.dot, selected && s.dotActive, rainbow(color, 'bg'))}>
                    {selected && <HookSVG className={s.checkIcon} />}
                  </div>
                </button>
              )
            })}

            <button className={s.dotWrapper}>
              <div className={cn(s.dot, rainbow('RED', 'bg'))}>
                <HookSVG className={s.checkIcon} />
              </div>
            </button>
          </div>
          <div className={s.customBlock}>
            <div className={s.customTitle}>custom color picker</div>

            <CustomColor />
          </div>
        </div>
      }
    >
      {children}
    </Tooltip>
  )
}

export default ColorSelector
