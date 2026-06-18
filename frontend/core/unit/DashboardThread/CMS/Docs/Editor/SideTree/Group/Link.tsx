import { type FC, useState } from 'react'

import MarkerPicker from '~/widgets/MarkerPicker'

import { DEFAULT_LINK_MARKER, SIDE_TREE_NODE_MENU_ACTION, SIDE_TREE_NODE_TYPE } from '../constant'
import useSalon from '../salon/group/link'
import type { TEditingTarget, TSideTreeLink, TSideTreeNodeMenuAction } from '../spec'
import ChildMenu from './ChildMenu'
import InlineTitleInput from './InlineTitleInput'

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
  onStyleChange: (groupId: string, childId: string, marker: TSideTreeLink['marker']) => void
}

const Link: FC<TProps> = ({
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
        <MarkerPicker
          compact
          active={active}
          value={item.marker ?? DEFAULT_LINK_MARKER}
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
        <ChildMenu
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

export default Link
