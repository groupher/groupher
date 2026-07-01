import { useState } from 'react'

import ArrowSVG from '~/icons/ArrowSimple'
import useDocFaqActions from '~/stores/dashboard/docFaq/actions'
import MarkdownEditor from '~/widgets/MarkdownEditor'

import { FIELD } from '../../../../constant'
import SavingBar from '../../../../SavingBar'
import { FAQ_EDITOR_COPY, FAQ_ITEM_MENU_ACTION, FAQ_SAVE_ZONE } from '../constant'
import InlineTextEditor from '../InlineTextEditor'
import useSalon, { cn } from '../salon/group/item'
import type { TFaqEditorItem, TFaqSaveZone } from '../spec'
import ActionMenu, { ITEM_MENU_ITEMS } from './ActionMenu'

type TProps = {
  groupId: string
  item: TFaqEditorItem
  opened: boolean
  saveZone: TFaqSaveZone
  editLocked: boolean
  isDocFaqTouched: boolean
  onToggle: (itemId: string) => void
}

export default function Item({
  groupId,
  item,
  opened,
  saveZone,
  editLocked,
  isDocFaqTouched,
  onToggle,
}: TProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const s = useSalon()
  const { clearSaveZone, handleItemAction, renameItem, setSaveZone, updateDetail } =
    useDocFaqActions()
  const titleActive = saveZone?.type === FAQ_SAVE_ZONE.ITEM_TITLE && saveZone.itemId === item.id
  const detailActive = saveZone?.type === FAQ_SAVE_ZONE.ITEM_DETAIL && saveZone.itemId === item.id
  const handleToggle = () => onToggle(item.id)

  return (
    <div className={s.wrapper}>
      <div className={s.header}>
        <InlineTextEditor
          value={item.title}
          active={titleActive}
          editDisabled={editLocked}
          isTouched={isDocFaqTouched}
          titleClassName={s.title}
          onChange={(title) => renameItem(groupId, item.id, title)}
          onDone={clearSaveZone}
          onStart={() => setSaveZone({ type: FAQ_SAVE_ZONE.ITEM_TITLE, groupId, itemId: item.id })}
        />

        {!editLocked && (
          <div className={cn(s.actions, menuOpen && 'opacity-100')}>
            <ActionMenu
              ariaLabel={FAQ_EDITOR_COPY.ITEM_ACTIONS_ARIA_LABEL}
              items={ITEM_MENU_ITEMS}
              onOpenChange={setMenuOpen}
              onSelect={(action) => {
                if (action === FAQ_ITEM_MENU_ACTION.RENAME) {
                  setSaveZone({ type: FAQ_SAVE_ZONE.ITEM_TITLE, groupId, itemId: item.id })
                  return
                }

                handleItemAction(groupId, item.id, action)
              }}
            />
          </div>
        )}
        {!titleActive && (
          <button
            type='button'
            className={s.chevronButton}
            aria-expanded={opened}
            aria-label={
              opened
                ? FAQ_EDITOR_COPY.COLLAPSE_ITEM_ARIA_LABEL
                : FAQ_EDITOR_COPY.EXPAND_ITEM_ARIA_LABEL
            }
            onClick={handleToggle}
          >
            <ArrowSVG className={cn(s.chevron, opened && s.chevronOpen)} />
          </button>
        )}
      </div>

      <div
        className={cn(s.detailMotion, opened ? s.detailMotionOpen : s.detailMotionClosed)}
        aria-hidden={!opened}
      >
        <div className={s.detailClip}>
          <MarkdownEditor
            className={s.detailEditor}
            textareaClassName={s.detailTextarea}
            disabled={!opened || (editLocked && !detailActive)}
            minRows={4}
            maxRows={12}
            value={item.detail}
            onChange={(detail) => updateDetail(groupId, item.id, detail)}
          />
          {opened && detailActive && (
            <div className={s.detailSavingBar}>
              <SavingBar
                field={FIELD.DOC_FAQ}
                isTouched={isDocFaqTouched}
                minimal
                top={2}
                bottom={2}
                onCancel={clearSaveZone}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
