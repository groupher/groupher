import type { FC } from 'react'

import { cn } from '~/css'
import ArrowSVG from '~/icons/ArrowSimple'
import EditSVG from '~/icons/EditPen'
import MoreSVG from '~/icons/menu/MoreL'
import Tooltip from '~/widgets/Tooltip'

import useSalon from '../../salon/header/editors/group_head'
import GroupInputer from './GroupInputer'
import GroupMenu from './GroupMenu'

type TGroupTitle = {
  title: string
  kind: 'link' | 'group' | 'system'
  collapsed: boolean
  onToggle?: () => void
}

const GroupTitle: FC<TGroupTitle> = ({ title, kind, collapsed, onToggle }) => {
  const s = useSalon()

  if (kind === 'link') {
    return <div className={s.hintTitle}>单链接</div>
  }

  return (
    <button type='button' className={s.title} onClick={onToggle}>
      {title} <ArrowSVG className={cn(s.arrowIcon, collapsed && s.arrowCollapsed)} />
    </button>
  )
}

type TProps = {
  title: string
  kind: 'link' | 'group' | 'system'
  curGroupIndex: number
  isEdgeLeft: boolean
  isEdgeRight: boolean

  moveRight: () => void
  moveLeft: () => void
  moveEdgeLeft: () => void
  moveEdgeRight: () => void
  onDelete: () => void
  collapsed?: boolean
  onToggle?: () => void
  editingGroup: string | null
  editingGroupIndex: number | null
  triggerGroupUpdate: (title: string, curGroupIndex: number) => void
  cancelGroupChange: () => void
  updateEditingGroup: (value: string) => void
  confirmGroupUpdate: () => void
}

const GroupHead: FC<TProps> = ({
  title,
  kind,
  curGroupIndex,
  moveLeft,
  moveRight,
  moveEdgeLeft,
  moveEdgeRight,
  onDelete,
  collapsed = false,
  onToggle,
  isEdgeLeft,
  isEdgeRight,
  editingGroup,
  editingGroupIndex,
  triggerGroupUpdate,
  cancelGroupChange,
  updateEditingGroup,
  confirmGroupUpdate,
}) => {
  const s = useSalon()

  // null is void empty checked when input value is ""
  if (kind === 'group' && editingGroup !== null && editingGroupIndex === curGroupIndex) {
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
      <GroupTitle title={title} kind={kind} collapsed={collapsed} onToggle={onToggle} />

      <div className='grow' />

      {kind === 'group' && (
        <EditSVG className={s.editIcon} onClick={() => triggerGroupUpdate(title, curGroupIndex)} />
      )}

      {kind !== 'system' && (
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
          placement='bottom-end'
          trigger='click'
          offset={[4, 0]}
          hideOnClick
          noPadding
        >
          <MoreSVG className={s.settingIcon} />
        </Tooltip>
      )}
    </div>
  )
}

export default GroupHead
