'use client'

import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'

import PlusSVG from '~/icons/Plus'
import useDocFaqActions from '~/stores/dashboard/docFaq/actions'
import Button from '~/widgets/Buttons/Button'
import SegmentTab from '~/widgets/Switcher/SegmentTab'

import { FIELD } from '../../../constant'
import SavingBar from '../../../SavingBar'
import {
  FAQ_EDITOR_COPY,
  FAQ_MODE,
  FAQ_MODE_ITEMS,
  FAQ_SAVE_ZONE,
  FAQ_SORTABLE_GROUP_ID_PREFIX,
} from './constant'
import DocFaqDndContext from './Dnd/DocFaqDndContext'
import Group from './Group'
import InlineTextEditor from './InlineTextEditor'
import useSalon from './salon'
import useFaqEditor from './useFaqEditor'

export default function FaqEditor() {
  const s = useSalon()
  const { docFaq, saveZone, isDocFaqTouched, displayGroups, openedItemId, openItem, toggleItem } =
    useFaqEditor()
  const {
    addGroup,
    addItem,
    clearSaveZone,
    reorderGroups,
    setDesc,
    setGroupedView,
    setSaveZone,
    setTitle,
  } = useDocFaqActions()
  const editLocked = saveZone !== null
  const listSaving = saveZone?.type === FAQ_SAVE_ZONE.LIST_ORDER
  const modeSaving = saveZone?.type === FAQ_SAVE_ZONE.MODE
  const activeMode = docFaq.groupedView ? FAQ_MODE.GROUPED : FAQ_MODE.FLAT
  const addButtonText = docFaq.groupedView ? FAQ_EDITOR_COPY.ADD_GROUP : FAQ_EDITOR_COPY.ADD_ITEM

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
          onChange={(key) => setGroupedView(key === FAQ_MODE.GROUPED)}
        />

        <Button
          disabled={editLocked}
          onClick={() => {
            if (docFaq.groupedView) {
              addGroup()
              return
            }

            openItem(addItem())
          }}
          ghost
          noBorder
          space={1.5}
          right={-1}
        >
          <PlusSVG className={s.addIcon} />
          <span>{addButtonText}</span>
        </Button>
      </div>

      {modeSaving && (
        <div className={s.modeSavingBar}>
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

      <DocFaqDndContext groups={displayGroups} onCommit={reorderGroups}>
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
                    grouped={docFaq.groupedView}
                    openedItemId={openedItemId}
                    saveZone={saveZone}
                    editLocked={editLocked}
                    isDocFaqTouched={isDocFaqTouched}
                    showTargetLine={isCrossGroupTarget}
                    targetDragItemId={targetDragItemId}
                    targetDragPosition={targetDragPosition}
                    onToggleItem={toggleItem}
                    onOpenItem={openItem}
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
