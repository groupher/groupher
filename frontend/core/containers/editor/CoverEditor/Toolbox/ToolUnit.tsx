import { type FC, useState, type ReactNode } from 'react'

import type { TTooltipPlacement } from '~/spec'
import Tooltip from '~/widgets/Tooltip'

import useSalon, { cn } from '../salon/toolbox/tool_unit'

type TProps = {
  title: string
  icon?: ReactNode
  panel?: ReactNode
  offset?: [number, number]
  placement?: TTooltipPlacement
  className?: string
}

const ToolUnit: FC<TProps> = ({
  title,
  icon,
  panel,
  offset = [-1, 5],
  className = '',
  placement = 'top',
}) => {
  const s = useSalon()
  const [panelOpen, setPanelOpen] = useState(false)

  return (
    <div className={cn(s.wrapper, className)}>
      <Tooltip
        content={<>{panelOpen && <>{panel}</>}</>}
        placement={placement}
        trigger="mouseenter focus"
        onShow={() => setPanelOpen(true)}
        onHide={() => setPanelOpen(false)}
        hideOnClick={false}
        offset={offset}
        noPadding
      >
        <div className={cn(s.block, panelOpen && s.blockActive)}>{icon}</div>
      </Tooltip>
      <div className={s.title}>{title}</div>
    </div>
  )
}

export default ToolUnit
