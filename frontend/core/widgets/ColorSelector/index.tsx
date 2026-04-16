/*
 *
 * ColorSelector
 *
 */

import { useState, type FC, type ReactNode } from 'react'
import type { TColorName, TTooltipPlacement } from '~/spec'
import Tooltip from '~/widgets/Tooltip'
import BuildInColors from './BuildInColors'
import CustomColor from './CustomColor'
import CustomColorPicker from './CustomColorPicker'

import useSalon from './salon'

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
  const s = useSalon()
  const [customColor, setCustomColor] = useState('#8B5CF6')

  return (
    <Tooltip
      placement={placement}
      trigger='click'
      hideOnClick={false}
      maxWidth='none'
      offset={offset}
      content={
        <div className={s.content} data-testid={testid}>
          <div className={s.selectRow}>
            <div className={s.buildInWrapper}>
              <BuildInColors activeColor={activeColor} onChange={onChange} excepts={excepts} />
            </div>

            <CustomColor color={customColor} />
          </div>

          <div className={s.customBlock}>
            <CustomColorPicker color={customColor} onChange={setCustomColor} />
          </div>
        </div>
      }
    >
      {children}
    </Tooltip>
  )
}

export default ColorSelector
