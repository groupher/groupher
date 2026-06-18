import { type FC, useState } from 'react'

import ArrowSVG from '~/icons/ArrowSimple'
import GrabDotsSVG from '~/icons/GrabDots'

import { SIDE_TREE_GROUP_MENU_ACTION, SIDE_TREE_NODE_TYPE } from '../constant'
import SortableSideTreeChild from '../Dnd/SortableSideTreeChild'
import SortableSideTreeColumn from '../Dnd/SortableSideTreeColumn'
import SortableSideTreeGroup from '../Dnd/SortableSideTreeGroup'
import type { TSideTreeDragTarget } from '../Dnd/spec'
import useSalon, { cn } from '../salon/group'
import type {
  TEditingTarget,
  TSideTreeChildMenuAction,
  TSideTreeGroupMenuAction,
  TSideTreeGroup,
  TSideTreeNodeMenuAction,
} from '../spec'
import File from './File'
import GroupMenu from './GroupMenu'
import InlineTitleInput from './InlineTitleInput'
import Link from './Link'

type TProps = {
  group: TSideTreeGroup
  activeId: string | null
  editingTarget: TEditingTarget
  showTargetLine: boolean
  targetDragItemId: string | null
  targetDragPosition: TSideTreeDragTarget['position'] | null
  onActivate: (id: string) => void
  onToggle: (groupId: string) => void
  onAddChild: (groupId: string, action: TSideTreeChildMenuAction) => void
  onDeleteGroup: (groupId: string) => void
  onRenameGroup: (groupId: string, title: string) => void
  onRenameChild: (groupId: string, childId: string, title: string) => void
  onCancelEdit: () => void
  onEdit: (target: TEditingTarget) => void
  onChildAction: (groupId: string, childId: string, action: TSideTreeNodeMenuAction) => void
  onChildStyleChange: (
    groupId: string,
    childId: string,
    marker: TSideTreeGroup['children'][number]['marker'],
  ) => void
}

const Group: FC<TProps> = ({
  group,
  activeId,
  editingTarget,
  showTargetLine,
  targetDragItemId,
  targetDragPosition,
  onActivate,
  onToggle,
  onAddChild,
  onDeleteGroup,
  onRenameGroup,
  onRenameChild,
  onCancelEdit,
  onEdit,
  onChildAction,
  onChildStyleChange,
}) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const s = useSalon({ actionVisible: menuOpen })
  const collapsed = group.expanded === false
  const editing =
    editingTarget?.type === SIDE_TREE_NODE_TYPE.GROUP && editingTarget.groupId === group.id
  const handleGroupMenuSelect = (action: TSideTreeGroupMenuAction): void => {
    if (
      action === SIDE_TREE_GROUP_MENU_ACTION.PAGE ||
      action === SIDE_TREE_GROUP_MENU_ACTION.LINK
    ) {
      onAddChild(group.id, action)
      return
    }

    if (action === SIDE_TREE_GROUP_MENU_ACTION.RENAME) {
      onEdit({ type: SIDE_TREE_NODE_TYPE.GROUP, groupId: group.id })
      return
    }

    onDeleteGroup(group.id)
  }

  return (
    <SortableSideTreeColumn
      className={cn(s.wrapper, showTargetLine && s.wrapperTarget)}
      columnId={group.id}
      disabled={editing}
    >
      {({ attributes, listeners, setActivatorNodeRef }) => (
        <>
          <div className={s.head}>
            {!editing && (
              <button
                ref={setActivatorNodeRef}
                type='button'
                className={s.dragHandle}
                aria-label='Drag docs group'
                {...attributes}
                {...listeners}
              >
                <GrabDotsSVG className={s.dragIcon} />
              </button>
            )}
            {editing ? (
              <InlineTitleInput
                value={group.title}
                onCancel={onCancelEdit}
                onConfirm={(title) => onRenameGroup(group.id, title)}
              />
            ) : (
              <button type='button' className={s.titleButton} onClick={() => onToggle(group.id)}>
                <span className={s.title}>{group.title}</span>
                <ArrowSVG className={cn(s.arrowIcon, collapsed && s.arrowCollapsed)} />
              </button>
            )}
            <div className={s.actions}>
              <GroupMenu onOpenChange={setMenuOpen} onSelect={handleGroupMenuSelect} />
            </div>
          </div>
          <SortableSideTreeGroup
            className={cn(s.children, collapsed && s.collapsed)}
            columnId={group.id}
            ids={group.children.map((child) => child.id)}
            disabled={collapsed}
          >
            {group.children.map((child) => {
              const childEditing =
                editingTarget !== null &&
                'childId' in editingTarget &&
                editingTarget.childId === child.id

              return (
                <SortableSideTreeChild
                  key={child.id}
                  id={child.id}
                  columnId={group.id}
                  editing={childEditing}
                  targetPosition={targetDragItemId === child.id ? targetDragPosition : null}
                >
                  {child.type === SIDE_TREE_NODE_TYPE.PAGE ? (
                    <File
                      groupId={group.id}
                      item={child}
                      active={activeId === child.id}
                      editingTarget={editingTarget}
                      onActivate={onActivate}
                      onRename={onRenameChild}
                      onCancelEdit={onCancelEdit}
                      onEdit={onEdit}
                      onAction={onChildAction}
                      onStyleChange={onChildStyleChange}
                    />
                  ) : (
                    <Link
                      groupId={group.id}
                      item={child}
                      active={activeId === child.id}
                      editingTarget={editingTarget}
                      onActivate={onActivate}
                      onRename={onRenameChild}
                      onCancelEdit={onCancelEdit}
                      onEdit={onEdit}
                      onAction={onChildAction}
                      onStyleChange={onChildStyleChange}
                    />
                  )}
                </SortableSideTreeChild>
              )
            })}
          </SortableSideTreeGroup>
        </>
      )}
    </SortableSideTreeColumn>
  )
}

export default Group
