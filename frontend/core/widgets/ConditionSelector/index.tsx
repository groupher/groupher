'use client'

import { type FC, useState, useRef } from 'react'

import type { TSpace, TTooltipPlacement, TConditionMode, TButtonPrefix } from '~/spec'

import useTrans from '~/hooks/useTrans'

import DropdownButton from '~/widgets/Buttons/DropdownButton'
import Menu from '~/widgets/Menu'

import ActiveLabel from './ActiveLabel'

import type { TActiveCondition } from './spec'
import { getMenuItems, getTitle, getActiveMenuItem } from './helper'
import useSalon from './salon'

type TProps = {
  mode: TConditionMode
  active?: TActiveCondition
  placement?: TTooltipPlacement
  selected?: boolean
  closable?: boolean
  prefixIcon?: TButtonPrefix

  onSelect?: (condition: TActiveCondition) => void
} & TSpace

const ConditionSelector: FC<TProps> = ({
  mode,
  active = null,
  onSelect = console.log,
  selected = false,
  placement = 'bottom',
  closable = true,
  prefixIcon = null,
  ...spacing
}) => {
  const [offset, setOffset] = useState([28, 5])
  const [menuOpen, setMenuOpen] = useState(false)
  const ref = useRef(null)

  const s = useSalon({ menuOpen, selected, ...spacing })
  const { t } = useTrans()

  const popWidth = 36

  const menuItems = getMenuItems(mode)
  const activeMenuItem = getActiveMenuItem(menuItems, active)

  const title = getTitle(mode)

  return (
    <div ref={ref} className={s.wrapper}>
      {!selected ? (
        <Menu
          offset={offset as [number, number]}
          items={menuItems}
          onSelect={(item) => onSelect(item.key as TActiveCondition)}
          onShow={() => setMenuOpen(true)}
          onHide={() => {
            // setOffset([30, 5])
            setMenuOpen(false)
          }}
          activeKey={active}
          placement={placement}
          popWidth={popWidth}
        >
          <DropdownButton $active={menuOpen} selected={selected} prefixIcon={prefixIcon}>
            {t(title, 'titleCase')}
            <div className="mr-1.5" />
          </DropdownButton>
        </Menu>
      ) : (
        <DropdownButton
          $active={menuOpen}
          selected={selected}
          closable={closable}
          onClear={() => {
            // simulate click to avoid menu pop again
            ref.current.click()
            onSelect(null)
          }}
          prefixIcon={prefixIcon}
        >
          <Menu
            offset={offset as [number, number]}
            items={menuItems}
            onSelect={(item) => onSelect(item.key as TActiveCondition)}
            onShow={() => {
              setOffset([8, 8])
              setMenuOpen(true)
            }}
            onHide={() => {
              setOffset([30, 5])
              setMenuOpen(false)
            }}
            activeKey={active}
            placement={placement}
            popWidth={popWidth}
          >
            <ActiveLabel activeItem={activeMenuItem} condition={active} />
          </Menu>
        </DropdownButton>
      )}
    </div>
  )
}

export default ConditionSelector
