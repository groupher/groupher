import { type FC, useState } from 'react'

import ArrowSVG from '~/icons/ArrowSimple'

import { SIDE_TREE_NODE_TYPE } from '../constant'
import useSalon, { cn } from '../salon/group'
import type {
  TEditingTarget,
  TSideTreeChildMenuAction,
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
  onActivate: (id: string) => void
  onToggle: (groupId: string) => void
  onAddChild: (groupId: string, action: TSideTreeChildMenuAction) => void
  onRenameGroup: (groupId: string, title: string) => void
  onRenameChild: (groupId: string, childId: string, title: string) => void
  onCancelEdit: () => void
  onEdit: (target: TEditingTarget) => void
  onChildAction: (groupId: string, childId: string, action: TSideTreeNodeMenuAction) => void
  onChildStyleChange: (
    groupId: string,
    childId: string,
    icon: TSideTreeGroup['children'][number]['icon'],
  ) => void
}

const Group: FC<TProps> = ({
  group,
  activeId,
  editingTarget,
  onActivate,
  onToggle,
  onAddChild,
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

  return (
    <div className={s.wrapper}>
      <div className={s.head}>
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
          <GroupMenu
            onOpenChange={setMenuOpen}
            onSelect={(action) => onAddChild(group.id, action)}
          />
        </div>
      </div>
      <div className={cn(s.children, collapsed && s.collapsed)}>
        {group.children.map((child) =>
          child.type === SIDE_TREE_NODE_TYPE.PAGE ? (
            <File
              key={child.id}
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
              key={child.id}
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
          ),
        )}
      </div>
    </div>
  )
}

export default Group
