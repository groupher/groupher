import { type FC, useState } from 'react'

import MarkerPicker from '~/widgets/MarkerPicker'

import { DEFAULT_PAGE_MARKER, SIDE_TREE_NODE_MENU_ACTION, SIDE_TREE_NODE_TYPE } from '../constant'
import useSalon from '../salon/group/file'
import type { TEditingTarget, TSideTreeNodeMenuAction, TSideTreePage } from '../spec'
import ChildMenu from './ChildMenu'
import InlineTitleInput from './InlineTitleInput'

type TProps = {
  groupId: string
  item: TSideTreePage
  active: boolean
  editingTarget: TEditingTarget
  onActivate: (id: string) => void
  onRename: (groupId: string, childId: string, title: string) => void
  onCancelEdit: () => void
  onEdit: (target: TEditingTarget) => void
  onAction: (groupId: string, childId: string, action: TSideTreeNodeMenuAction) => void
  onStyleChange: (groupId: string, childId: string, marker: TSideTreePage['marker']) => void
}

const File: FC<TProps> = ({
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
    editingTarget?.type === SIDE_TREE_NODE_TYPE.PAGE && editingTarget.childId === item.id

  return (
    <div className={s.wrapper}>
      <div className={s.pickerSlot}>
        <MarkerPicker
          compact
          active={active}
          value={item.marker ?? DEFAULT_PAGE_MARKER}
          onChange={(value) => onStyleChange(groupId, item.id, value)}
        />
      </div>
      {editing ? (
        <InlineTitleInput
          value={item.title || ''}
          onCancel={onCancelEdit}
          onConfirm={(title) => onRename(groupId, item.id, title)}
        />
      ) : (
        <button type='button' className={s.titleButton} onClick={() => onActivate(item.id)}>
          {item.title || item.path || 'Untitled'}
        </button>
      )}
      {item.badge && <div className={s.badge}>{item.badge}</div>}
      <div className={s.actions}>
        <ChildMenu
          onOpenChange={setMenuOpen}
          onSelect={(action) => {
            if (action === SIDE_TREE_NODE_MENU_ACTION.RENAME) {
              onEdit({ type: SIDE_TREE_NODE_TYPE.PAGE, groupId, childId: item.id })
              return
            }
            onAction(groupId, item.id, action)
          }}
        />
      </div>
    </div>
  )
}

export default File
