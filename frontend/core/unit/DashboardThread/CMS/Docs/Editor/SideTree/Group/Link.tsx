import { type FC, useState } from 'react'

import useTrans from '~/hooks/useTrans'
import MarkerPicker from '~/widgets/MarkerPicker'

import {
  DEFAULT_LINK_MARKER,
  SIDE_TREE_NODE_MENU_ACTION,
  SIDE_TREE_NODE_TYPE,
  UNTITLED_TITLE_I18N_KEY,
} from '../constant'
import { getDefaultLinkTitle } from '../helper'
import useSalon, { cn } from '../salon/group/link'
import type {
  TEditingTarget,
  TSideTreeLink,
  TSideTreeLinkInput,
  TSideTreeNodeMenuAction,
} from '../spec'
import ChildMenu from './ChildMenu'
import HighlightTitle from './HighlightTitle'
import LinkInlineEditor from './LinkInlineEditor'

type TProps = {
  groupId: string
  item: TSideTreeLink
  editingTarget: TEditingTarget
  searchQuery?: string
  searching?: boolean
  onRename: (groupId: string, childId: string, input: TSideTreeLinkInput) => void
  onCancelEdit: () => void
  onEdit: (target: TEditingTarget) => void
  onAction: (groupId: string, childId: string, action: TSideTreeNodeMenuAction) => void
  onStyleChange: (groupId: string, childId: string, marker: TSideTreeLink['marker']) => void
}

const Link: FC<TProps> = ({
  groupId,
  item,
  editingTarget,
  searchQuery = '',
  searching = false,
  onRename,
  onCancelEdit,
  onEdit,
  onAction,
  onStyleChange,
}) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const { t } = useTrans()
  const s = useSalon({ actionVisible: !searching && menuOpen })
  const editing =
    editingTarget?.type === SIDE_TREE_NODE_TYPE.LINK && editingTarget.childId === item.id
  const titleValue =
    item.title && item.title !== t(UNTITLED_TITLE_I18N_KEY)
      ? item.title
      : getDefaultLinkTitle(item.href)

  return (
    <div className={cn(s.wrapper, editing && s.wrapperEditing)}>
      <div className={s.pickerSlot}>
        <MarkerPicker
          compact
          value={item.marker ?? DEFAULT_LINK_MARKER}
          triggerClassName={searching ? s.markerReadonly : undefined}
          onChange={(value) => {
            if (searching) return
            onStyleChange(groupId, item.id, value)
          }}
        />
      </div>
      {editing ? (
        <LinkInlineEditor
          href={item.href}
          title={titleValue}
          onCancel={onCancelEdit}
          onConfirm={(input) => onRename(groupId, item.id, input)}
        />
      ) : (
        <div className={s.titleCluster}>
          <a href={item.href} target='_blank' rel='noreferrer' className={s.titleButton}>
            <HighlightTitle className={s.titleText} query={searchQuery} text={item.title} />
          </a>
        </div>
      )}
      {!searching && !editing && (
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
      )}
    </div>
  )
}

export default Link
