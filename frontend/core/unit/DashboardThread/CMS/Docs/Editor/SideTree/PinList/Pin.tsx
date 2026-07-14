import { type FC, useState } from 'react'

import useTrans from '~/hooks/useTrans'
import MarkerPicker from '~/widgets/MarkerPicker'

import { DEFAULT_PIN_MARKER, SIDE_TREE_NODE_TYPE, UNTITLED_TITLE_I18N_KEY } from '../constant'
import LinkInlineEditor from '../Group/LinkInlineEditor'
import { getDefaultLinkTitle } from '../helper'
import useSalon, { cn } from '../salon/pin'
import type { TEditingTarget, TSideTreeLinkInput, TSideTreePin } from '../spec'
import PinMenu from './PinMenu'

type TProps = {
  item: TSideTreePin
  editingTarget: TEditingTarget
  onCancelEdit: () => void
  onDelete: (pinId: string) => void
  onEdit: (target: TEditingTarget) => void
  onSave: (pinId: string, input: TSideTreeLinkInput) => void
  onStyleChange: (pinId: string, marker: TSideTreePin['marker']) => void
}

const Pin: FC<TProps> = ({
  item,
  editingTarget,
  onCancelEdit,
  onDelete,
  onEdit,
  onSave,
  onStyleChange,
}) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const { t } = useTrans()
  const s = useSalon({ actionVisible: menuOpen })
  const editing = editingTarget?.type === SIDE_TREE_NODE_TYPE.PIN && editingTarget.pinId === item.id
  const titleValue =
    item.title && item.title !== t(UNTITLED_TITLE_I18N_KEY)
      ? item.title
      : getDefaultLinkTitle(item.href) || item.title

  return (
    <div className={cn(s.wrapper, editing && s.wrapperEditing)}>
      <div className={s.pickerSlot}>
        <MarkerPicker
          compact
          appearance
          iconSize={4}
          value={item.marker ?? DEFAULT_PIN_MARKER}
          triggerClassName={cn(s.markerTrigger, editing && s.markerEditing)}
          onChange={(marker) => onStyleChange(item.id, marker)}
        />
      </div>

      {editing ? (
        <LinkInlineEditor
          href={item.href}
          title={titleValue}
          onCancel={onCancelEdit}
          onConfirm={(input) => onSave(item.id, input)}
        />
      ) : (
        <a href={item.href} target='_blank' rel='noreferrer' className={s.title}>
          {titleValue || t(UNTITLED_TITLE_I18N_KEY)}
        </a>
      )}

      {!editing && (
        <div className={s.actions}>
          <PinMenu
            onOpenChange={setMenuOpen}
            onEdit={() => onEdit({ type: SIDE_TREE_NODE_TYPE.PIN, pinId: item.id })}
            onDelete={() => onDelete(item.id)}
          />
        </div>
      )}
    </div>
  )
}

export default Pin
