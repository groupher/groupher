import { type FC, type KeyboardEvent, type MouseEvent, useState } from 'react'

import MarkerPicker from '~/widgets/MarkerPicker'

import { DEFAULT_PAGE_MARKER, SIDE_TREE_NODE_MENU_ACTION, SIDE_TREE_NODE_TYPE } from '../constant'
import { isPublicDoc, needsPublishAttention } from '../helper'
import useSalon from '../salon/group/file'
import type { TEditingTarget, TSideTreeNodeMenuAction, TSideTreePage } from '../spec'
import ChildMenu from './ChildMenu'
import InlineTitleInput from './InlineTitleInput'

type TProps = {
  groupId: string
  groupInCover?: boolean
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
  groupInCover = false,
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
  const showPublishDot = needsPublishAttention(item.publishState)
  const publicDoc = isPublicDoc(item.publishState)
  const activate = (): void => onActivate(item.id)
  const stopRowActivate = (event: MouseEvent<HTMLDivElement>): void => event.stopPropagation()
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (editing) return

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      activate()
    }
  }

  return (
    <div
      className={s.wrapper}
      role={editing ? undefined : 'button'}
      tabIndex={editing ? undefined : 0}
      onClick={editing ? undefined : activate}
      onKeyDown={handleKeyDown}
    >
      <div className={s.pickerSlot} onClick={stopRowActivate}>
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
        <div className={s.titleCluster}>
          <span className={s.titleButton}>{item.title || item.path || 'Untitled'}</span>
        </div>
      )}
      {item.badge && <div className={s.badge}>{item.badge}</div>}
      <div className={s.meta} onClick={stopRowActivate}>
        {showPublishDot && (
          <div className={s.publishDotSlot}>
            <span className={s.unpublishedDot} aria-hidden='true' />
          </div>
        )}
        <div className={s.actions}>
          <ChildMenu
            moveToDraftVisible={publicDoc}
            coverToggleVisible={groupInCover && publicDoc}
            hiddenFromCover={item.publishState?.hiddenFromCover === true}
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
    </div>
  )
}

export default File
