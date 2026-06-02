import { AnimatePresence, domAnimation, LazyMotion, m } from 'motion/react'
import { useState } from 'react'

import ArrowSVG from '~/icons/ArrowSimple'
import MarkdownEditor from '~/widgets/MarkdownEditor'

import { FIELD } from '../../../../constant'
import SavingBar from '../../../../SavingBar'
import { FAQ_EDITOR_COPY, FAQ_ITEM_MENU_ACTION, FAQ_SAVE_ZONE } from '../constant'
import InlineTextEditor from '../InlineTextEditor'
import useSalon, { cn } from '../salon/group/item'
import type { TFaqEditorItem, TFaqItemMenuAction, TFaqSaveZone } from '../spec'
import ActionMenu, { ITEM_MENU_ITEMS } from './ActionMenu'

const DETAIL_TRANSITION = {
  duration: 0.18,
  ease: [0.16, 1, 0.3, 1],
} as const

type TProps = {
  groupId: string
  item: TFaqEditorItem
  opened: boolean
  saveZone: TFaqSaveZone
  editLocked: boolean
  isDocFaqTouched: boolean
  onAction: (groupId: string, itemId: string, action: TFaqItemMenuAction) => void
  onClearSaveZone: () => void
  onRename: (groupId: string, itemId: string, title: string) => void
  onSetSaveZone: (zone: TFaqSaveZone) => void
  onToggle: (itemId: string) => void
  onUpdateDetail: (groupId: string, itemId: string, detail: string) => void
}

export default function Item({
  groupId,
  item,
  opened,
  saveZone,
  editLocked,
  isDocFaqTouched,
  onAction,
  onClearSaveZone,
  onRename,
  onSetSaveZone,
  onToggle,
  onUpdateDetail,
}: TProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const s = useSalon()
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
          onChange={(title) => onRename(groupId, item.id, title)}
          onDone={onClearSaveZone}
          onStart={() =>
            onSetSaveZone({ type: FAQ_SAVE_ZONE.ITEM_TITLE, groupId, itemId: item.id })
          }
        />

        {!editLocked && (
          <div className={cn(s.actions, menuOpen && 'opacity-100')}>
            <ActionMenu
              ariaLabel={FAQ_EDITOR_COPY.ITEM_ACTIONS_ARIA_LABEL}
              items={ITEM_MENU_ITEMS}
              onOpenChange={setMenuOpen}
              onSelect={(action) => {
                if (action === FAQ_ITEM_MENU_ACTION.RENAME) {
                  onSetSaveZone({ type: FAQ_SAVE_ZONE.ITEM_TITLE, groupId, itemId: item.id })
                  return
                }

                onAction(groupId, item.id, action)
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

      <LazyMotion features={domAnimation}>
        <AnimatePresence initial={false}>
          {opened && (
            <m.div
              className={s.detailMotion}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={DETAIL_TRANSITION}
            >
              <MarkdownEditor
                className={s.detailEditor}
                textareaClassName={s.detailTextarea}
                disabled={editLocked && !detailActive}
                minRows={4}
                maxRows={12}
                value={item.detail}
                onChange={(detail) => onUpdateDetail(groupId, item.id, detail)}
              />
              {detailActive && (
                <div className={s.detailSavingBar}>
                  <SavingBar
                    field={FIELD.DOC_FAQ}
                    isTouched={isDocFaqTouched}
                    minimal
                    top={2}
                    bottom={2}
                    onCancel={onClearSaveZone}
                  />
                </div>
              )}
            </m.div>
          )}
        </AnimatePresence>
      </LazyMotion>
    </div>
  )
}
