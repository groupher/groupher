'use client'

import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'

import PlusSVG from '~/icons/Plus'
import Button from '~/widgets/Buttons/Button'
import SegmentTab from '~/widgets/Switcher/SegmentTab'

import { FIELD } from '../../../constant'
import SavingBar from '../../../SavingBar'
import {
  FAQ_EDITOR_COPY,
  FAQ_GROUP_MENU_ACTION,
  FAQ_MODE,
  FAQ_MODE_ITEMS,
  FAQ_SAVE_ZONE,
  FAQ_SORTABLE_GROUP_ID_PREFIX,
} from './constant'
import DocFaqDndContext from './DocFaqDndContext'
import Group from './Group'
import InlineTextEditor from './InlineTextEditor'
import useSalon from './salon'
import useFaqEditor from './useFaqEditor'

export default function FaqEditor() {
  const s = useSalon()
  const {
    docFaq,
    saveZone,
    isDocFaqTouched,
    openedItemId,
    addGroup,
    addItem,
    clearSaveZone,
    handleGroupAction,
    handleItemAction,
    renameGroup,
    renameItem,
    reorderGroups,
    setDesc,
    setGrouped,
    setSaveZone,
    setTitle,
    toggleItem,
    updateDetail,
  } = useFaqEditor()
  const editLocked = saveZone !== null
  const listSaving = saveZone?.type === FAQ_SAVE_ZONE.LIST_ORDER
  const activeMode = docFaq.grouped ? FAQ_MODE.GROUPED : FAQ_MODE.FLAT
  const addButtonText = docFaq.grouped ? FAQ_EDITOR_COPY.ADD_GROUP : FAQ_EDITOR_COPY.ADD_ITEM

  return (
    <div className={s.wrapper}>
      <InlineTextEditor
        value={docFaq.title}
        active={saveZone?.type === FAQ_SAVE_ZONE.TITLE}
        editDisabled={editLocked}
        grow={false}
        isTouched={isDocFaqTouched}
        titleClassName={s.titleText}
        onChange={setTitle}
        onDone={clearSaveZone}
        onStart={() => setSaveZone({ type: FAQ_SAVE_ZONE.TITLE })}
      />
      <div className={s.descBlock}>
        <InlineTextEditor
          value={docFaq.desc}
          active={saveZone?.type === FAQ_SAVE_ZONE.DESC}
          editDisabled={editLocked}
          grow={false}
          isTouched={isDocFaqTouched}
          titleClassName={s.descText}
          onChange={setDesc}
          onDone={clearSaveZone}
          onStart={() => setSaveZone({ type: FAQ_SAVE_ZONE.DESC })}
        />
      </div>

      <div className={s.toolbar}>
        <SegmentTab
          items={FAQ_MODE_ITEMS}
          activeKey={activeMode}
          ariaLabel={FAQ_EDITOR_COPY.MODE_ARIA_LABEL}
          onChange={(key) => setGrouped(key === FAQ_MODE.GROUPED)}
        />

        <Button
          disabled={editLocked}
          onClick={() => (docFaq.grouped ? addGroup() : addItem())}
          ghost
          noBorder
          space={1.5}
          right={-1}
        >
          <PlusSVG className={s.addIcon} />
          <span>{addButtonText}</span>
        </Button>
      </div>

      <DocFaqDndContext groups={docFaq.groups} onCommit={reorderGroups}>
        {({
          activeDragColumnId,
          columns,
          targetDragColumnId,
          targetDragItemId,
          targetDragPosition,
        }) => (
          <div className={s.groups}>
            <SortableContext
              items={columns.map((group) => `${FAQ_SORTABLE_GROUP_ID_PREFIX}:${group.id}`)}
              strategy={rectSortingStrategy}
            >
              {columns.map((group) => {
                const isCrossGroupTarget =
                  !!activeDragColumnId &&
                  !!targetDragColumnId &&
                  targetDragColumnId === group.id &&
                  activeDragColumnId !== group.id

                return (
                  <Group
                    key={group.id}
                    group={group}
                    grouped={docFaq.grouped}
                    openedItemId={openedItemId}
                    saveZone={saveZone}
                    editLocked={editLocked}
                    isDocFaqTouched={isDocFaqTouched}
                    showTargetLine={isCrossGroupTarget}
                    targetDragItemId={targetDragItemId}
                    targetDragPosition={targetDragPosition}
                    onAddItem={addItem}
                    onClearSaveZone={clearSaveZone}
                    onDeleteGroup={(groupId) =>
                      handleGroupAction(groupId, FAQ_GROUP_MENU_ACTION.DELETE)
                    }
                    onItemAction={handleItemAction}
                    onRenameGroup={renameGroup}
                    onRenameItem={renameItem}
                    onSetSaveZone={setSaveZone}
                    onToggleItem={toggleItem}
                    onUpdateDetail={updateDetail}
                  />
                )
              })}
            </SortableContext>
          </div>
        )}
      </DocFaqDndContext>

      {listSaving && (
        <div className={s.listSavingBar}>
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
  )
}
