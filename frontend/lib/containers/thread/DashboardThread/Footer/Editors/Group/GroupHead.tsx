import type { FC } from 'react'

import Tooltip from '~/widgets/Tooltip'
import MoreSVG from '~/icons/menu/MoreL'
import EditSVG from '~/icons/EditPen'

import GroupMenu from '../GroupMenu'
import GroupInputer from '../GroupInputer'

import useFooter from '../../../logic/useFooter'
import useSalon from '../../../salon/footer/editors/group/group_head'

type TProps = {
  title: string
  editingGroup: string | null
  editingGroupIndex: number | null
  curGroupIndex: number
  isEdgeLeft: boolean
  isEdgeRight: boolean

  moveRight: () => void
  moveLeft: () => void
  moveEdgeLeft: () => void
  moveEdgeRight: () => void
  onDelete: () => void
}

const GroupHead: FC<TProps> = ({
  title,
  editingGroup,
  curGroupIndex,
  editingGroupIndex,
  moveLeft,
  moveRight,
  moveEdgeLeft,
  moveEdgeRight,
  onDelete,
  isEdgeLeft,
  isEdgeRight,
}) => {
  const s = useSalon()

  const { triggerGroupUpdate, cancelGroupChange, updateEditingGroup, confirmGroupUpdate } =
    useFooter()

  // null is void empty checked when input value is ""
  if (editingGroup !== null && editingGroupIndex === curGroupIndex) {
    return (
      <div className={s.wrapper}>
        <GroupInputer
          value={editingGroup}
          onChange={updateEditingGroup}
          onConfirm={confirmGroupUpdate}
          onCancel={cancelGroupChange}
        />
      </div>
    )
  }
  return (
    <div className={s.wrapper}>
      <div className={s.title}>{title}</div>
      <div className="grow" />
      <EditSVG onClick={() => triggerGroupUpdate(title, curGroupIndex)} className={s.icon} />
      <Tooltip
        content={
          <GroupMenu
            moveLeft={moveLeft}
            moveRight={moveRight}
            moveEdgeLeft={moveEdgeLeft}
            moveEdgeRight={moveEdgeRight}
            isEdgeLeft={isEdgeLeft}
            isEdgeRight={isEdgeRight}
            onDelete={onDelete}
          />
        }
        placement="bottom-end"
        trigger="click"
        offset={[4, 0]}
        hideOnClick
        noPadding
      >
        <MoreSVG className={s.icon} />
      </Tooltip>
    </div>
  )
}

export default GroupHead
