/*
 *
 * Menu
 *
 */

import { type ReactNode, type FC, memo } from 'react'

import type { TTooltipPlacement } from '~/spec'
import Tooltip from '~/widgets/Tooltip'

import type { TMenuItem } from './spec'
import List from './List'

import useSalon from './salon'

type TProps = {
  activeKey?: string
  items?: TMenuItem[]
  onSelect?: (item: TMenuItem) => void
  children?: ReactNode
  offset?: [number, number]
  placement?: TTooltipPlacement
  onShow?: () => void
  onHide?: () => void
  popWidth?: number
}

const Menu: FC<TProps> = ({
  activeKey = '',
  onSelect = console.log,
  items = [],
  children = 'menu',
  onShow = console.log,
  onHide = console.log,
  placement = 'bottom',
  offset = [-5, 5],
  popWidth = 36,
}) => {
  const s = useSalon()

  return (
    <Tooltip
      placement={placement}
      trigger="click"
      onShow={() => onShow?.()}
      onHide={() => onHide?.()}
      offset={offset as [number, number]}
      noPadding
      content={<List items={items} activeKey={activeKey} onSelect={onSelect} popWidth={popWidth} />}
    >
      <div className={s.wrapper}>{children}</div>
    </Tooltip>
  )
}

export default memo(Menu)
