import { type FC, memo, type ReactNode, useState } from 'react'

import type { TMenuOption, TTooltipPlacement } from '~/spec'
import Tooltip from '~/ui/Tooltip'

import Menu from './Menu'

// import { Wrapper } from '../styles/menu_button'

type TProps = {
  children: ReactNode
  options: TMenuOption[]
  extraOptions?: TMenuOption[]
  placement?: TTooltipPlacement
  panelMinWidth?: string
  offset?: [number, number]
  onClick?: (key?: string) => void
}

const DEFAULT_EXTRA_OPTIONS: TMenuOption[] = []

const MenuButton: FC<TProps> = ({
  children,
  options,
  extraOptions = DEFAULT_EXTRA_OPTIONS,
  offset = [5, 5],
  onClick = console.log,
  placement = 'top-end',
  panelMinWidth = 'w-28',
}) => {
  const [active, setActive] = useState(false)

  return (
    <Tooltip
      placement={placement}
      trigger='click'
      hideOnClick
      offset={offset}
      onShow={() => setActive(true)}
      onHide={() => setActive(false)}
      content={
        <Menu
          options={options}
          extraOptions={extraOptions}
          onClick={onClick}
          panelMinWidth={panelMinWidth}
          active={active}
        />
      }
      noPadding
    >
      {children}
    </Tooltip>
  )
}

export default memo(MenuButton)
