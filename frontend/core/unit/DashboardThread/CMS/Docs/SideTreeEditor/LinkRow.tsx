import { type FC, useState } from 'react'

import NodeStylePicker from '~/widgets/NodeStylePicker'

import { DEFAULT_LINK_STYLE, SIDE_TREE_NODE_MENU_ACTION, SIDE_TREE_NODE_TYPE } from './constant'
import InlineTitleInput from './InlineTitleInput'
import NodeActionMenu from './NodeActionMenu'
import useSalon from './salon/link_row'
import type { TEditingTarget, TSideTreeLink, TSideTreeNodeMenuAction } from './spec'

type TProps = {
  groupId: string
  item: TSideTreeLink
  active: boolean
  editingTarget: TEditingTarget
  onActivate: (id: string) => void
  onRename: (groupId: string, childId: string, title: string) => void
  onCancelEdit: () => void
  onEdit: (target: TEditingTarget) => void
  onAction: (groupId: string, childId: string, action: TSideTreeNodeMenuAction) => void
  onStyleChange: (groupId: string, childId: string, icon: TSideTreeLink['icon']) => void
}

const LinkRow: FC<TProps> = ({
  groupId,
  item,
  active,
  editingTarget,
  onActivate,
  onRename,
  onCancelEdit,
  onEdit,
  onAction,
  onStyleChange,
}) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const s = useSalon({ active, actionVisible: menuOpen })
  const editing =
    editingTarget?.type === SIDE_TREE_NODE_TYPE.LINK && editingTarget.childId === item.id

  return (
    <div className={s.wrapper}>
      <div className={s.pickerSlot}>
        <NodeStylePicker
          compact
          value={item.icon ?? DEFAULT_LINK_STYLE}
          onChange={(value) => onStyleChange(groupId, item.id, value)}
        />
      </div>
      {editing ? (
        <InlineTitleInput
          value={item.title}
          onCancel={onCancelEdit}
          onConfirm={(title) => onRename(groupId, item.id, title)}
        />
      ) : (
        <button type='button' className={s.titleButton} onClick={() => onActivate(item.id)}>
          {item.title}
        </button>
      )}
      <div className={s.href}>{item.href}</div>
      <div className={s.actions}>
        <NodeActionMenu
          onOpenChange={setMenuOpen}
          onSelect={(action) => {
            if (action === SIDE_TREE_NODE_MENU_ACTION.RENAME) {
              onEdit({ type: SIDE_TREE_NODE_TYPE.LINK, groupId, childId: item.id })
              return
            }
            onAction(groupId, item.id, action)
          }}
        />
      </div>
    </div>
  )
}

export default LinkRow
