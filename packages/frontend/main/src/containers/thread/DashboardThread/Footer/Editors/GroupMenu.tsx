import type { FC } from 'react'

import MenuItem from '~/widgets/MenuItem'
import MENU from '~/const/menu'

import useSalon from '../../salon/footer/editors/link_menu'

type TProps = {
  moveLeft?: () => void
  moveRight?: () => void

  moveEdgeLeft?: () => void
  moveEdgeRight?: () => void
  onDelete?: () => void

  isEdgeLeft: boolean
  isEdgeRight: boolean
}

const GroupMenu: FC<TProps> = ({
  moveLeft = console.log,
  moveRight = console.log,
  moveEdgeLeft = console.log,
  moveEdgeRight = console.log,
  onDelete = console.log,

  isEdgeLeft,
  isEdgeRight,
}) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      {!isEdgeLeft && <MenuItem icon={MENU.ARROW_LEFT} title="左移" onClick={() => moveLeft()} />}

      {!isEdgeRight && (
        <MenuItem icon={MENU.ARROW_RIGHT} title="右移" onClick={() => moveRight()} />
      )}

      {!isEdgeLeft && (
        <MenuItem icon={MENU.ARROW_TO_LEFT} title="移至最前" onClick={() => moveEdgeLeft()} />
      )}
      {!isEdgeRight && (
        <MenuItem icon={MENU.ARROW_TO_RIGHT} title="移至最后" onClick={() => moveEdgeRight()} />
      )}
      <MenuItem icon={MENU.DELETE} title="删除" onClick={() => onDelete()} />
    </div>
  )
}

export default GroupMenu
