import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { type FC, useState } from 'react'

import TYPE from '~/const/type'
import useTrans from '~/hooks/useTrans'
import CloseLightSVG from '~/icons/CloseLight'
import Drawer from '~/ui/Drawer'
import IconHub from '~/ui/IconHub'
import SavingBar from '~/unit/DashboardThread/SavingBar'

import AddTabButton from '../../AddTabButton'
import type { TSideTreeController, TSideTreeTab } from '../../SideTree/spec'
import DeleteTabModal from './DeleteTabModal'
import useSalon from './salon'
import SortableTabRow from './SortableTabRow'

type TProps = {
  controller: TSideTreeController
  show: boolean
  onClose: () => void
}

type TPendingAction =
  | { type: 'rename'; tabId: string }
  | { type: 'sort'; tabs: TSideTreeTab[]; movedTabId: string }
  | { type: 'add' }
  | null

const SettingsDrawer: FC<TProps> = ({ controller, show, onClose }) => {
  const s = useSalon()
  const { t } = useTrans()
  const [pendingDelete, setPendingDelete] = useState<TSideTreeTab | null>(null)
  const [pendingAction, setPendingAction] = useState<TPendingAction>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = ({ active, over }: DragEndEvent): void => {
    if (!over || active.id === over.id) return

    const sourceTabs = pendingAction?.type === 'sort' ? pendingAction.tabs : controller.tabs
    const oldIndex = sourceTabs.findIndex((tab) => tab.id === active.id)
    const newIndex = sourceTabs.findIndex((tab) => tab.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    setPendingAction({
      type: 'sort',
      tabs: arrayMove(sourceTabs, oldIndex, newIndex),
      movedTabId: String(active.id),
    })
  }

  const closeDrawer = (): void => {
    setPendingAction(null)
    onClose()
  }

  const cancelPendingAction = (): void => setPendingAction(null)

  const confirmPendingAction = (): void => {
    if (pendingAction?.type === 'sort') {
      controller.reorderTabs(pendingAction.tabs, pendingAction.movedTabId)
    }
    if (pendingAction?.type === 'add') controller.addTab()
    setPendingAction(null)
  }

  const displayedTabs = pendingAction?.type === 'sort' ? pendingAction.tabs : controller.tabs
  const hasBottomAction = pendingAction?.type === 'sort' || pendingAction?.type === 'add'

  return (
    <>
      <Drawer show={show} onClose={closeDrawer} type={TYPE.DRAWER.DOC_TABS}>
        <div className={s.drawer}>
          <div className={s.header}>
            <div className={s.titleGroup}>
              <IconHub
                provider='phosphor'
                icon='sliders-horizontal'
                size={4.5}
                className={s.titleIcon}
              />
              <div className={s.title}>{t('dsb.doc.tabs.manage')}</div>
            </div>
            <button
              type='button'
              className={s.closeButton}
              aria-label={t('dsb.doc.tabs.close_settings')}
              onClick={closeDrawer}
            >
              <CloseLightSVG className={s.closeIcon} />
            </button>
          </div>

          <div className={s.body}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={displayedTabs.map((tab) => tab.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className={s.list}>
                  {displayedTabs.map((tab) => (
                    <SortableTabRow
                      key={tab.id}
                      tab={tab}
                      canDelete={controller.tabs.length > 1}
                      editing={pendingAction?.type === 'rename' && pendingAction.tabId === tab.id}
                      dragLocked={pendingAction !== null && pendingAction.type !== 'sort'}
                      interactionLocked={pendingAction !== null}
                      onStartRename={() => setPendingAction({ type: 'rename', tabId: tab.id })}
                      onCancelRename={cancelPendingAction}
                      onRename={(tabId, title) => {
                        controller.renameTab(tabId, title)
                        setPendingAction(null)
                      }}
                      onDelete={setPendingDelete}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <div className={s.footer}>
              {pendingAction === null && (
                <div className={s.addTab}>
                  <AddTabButton
                    placement='drawer'
                    onClick={() => setPendingAction({ type: 'add' })}
                  />
                </div>
              )}
              <SavingBar
                isTouched={hasBottomAction}
                density='compact'
                view='bottom'
                cancelIcon={null}
                prefix={
                  pendingAction?.type === 'sort'
                    ? t('dsb.doc.tabs.save_sort')
                    : t('dsb.doc.empty_action.add_tab')
                }
                wrapperClassName={s.bottomSavingBar}
                onCancel={cancelPendingAction}
                onConfirm={confirmPendingAction}
              />
            </div>
          </div>
        </div>
      </Drawer>

      <DeleteTabModal
        tab={pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={controller.deleteTab}
      />
    </>
  )
}

export default SettingsDrawer
