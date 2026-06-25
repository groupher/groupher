'use client'

import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import { type FC, useDeferredValue, useMemo, useState } from 'react'

import useTrans from '~/hooks/useTrans'

import {
  DOC_EDITOR_SIDE_TREE_STICKY_HEIGHT,
  DOC_EDITOR_SIDE_TREE_STICKY_TOP,
} from '../salon/layout'
import { SIDE_TREE_NODE_TYPE } from './constant'
import CoverWarningModal from './CoverWarningModal'
import SideTreeDndContext from './Dnd/SideTreeDndContext'
import Group from './Group'
import useSalon from './salon'
import type { TSideTreeController, TSideTreeGroup } from './spec'
import Toolbar from './Toolbar'

const GROUP_LAYOUT_TRANSITION = {
  duration: 180,
  easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
} as const

type TProps = {
  controller: TSideTreeController
}

const normalizeSearchQuery = (query: string): string => query.trim().toLowerCase()

const filterGroupsByDocTitle = (
  groups: readonly TSideTreeGroup[],
  query: string,
): TSideTreeGroup[] => {
  const normalizedQuery = normalizeSearchQuery(query)

  if (!normalizedQuery) return [...groups]

  return groups.flatMap((group) => {
    const children = group.children.filter(
      (child) =>
        (child.type === SIDE_TREE_NODE_TYPE.PAGE || child.type === SIDE_TREE_NODE_TYPE.LINK) &&
        (child.title || '').toLowerCase().includes(normalizedQuery),
    )

    if (children.length === 0) return []

    return [{ ...group, expanded: true, children }]
  })
}

const SideTree: FC<TProps> = ({ controller }) => {
  const s = useSalon()
  const { t } = useTrans()
  const [groupListRef] = useAutoAnimate(GROUP_LAYOUT_TRANSITION)
  const [searching, setSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const {
    groups,
    activeId,
    editingTarget,
    coverWarning,
    activate,
    addChild,
    clearCoverWarning,
    deleteGroup,
    toggleGroup,
    toggleCoverGroup,
    publishGroup,
    moveGroupToDraft,
    renameGroup,
    renameChild,
    renameLink,
    cancelEdit,
    edit,
    handleChildAction,
    updateChildStyle,
    reorderGroups,
  } = controller
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const normalizedDeferredSearchQuery = normalizeSearchQuery(deferredSearchQuery)
  const searchActive = searching && normalizedDeferredSearchQuery.length > 0
  const visibleGroups = useMemo(
    () => filterGroupsByDocTitle(groups, deferredSearchQuery),
    [groups, deferredSearchQuery],
  )

  const closeSearch = (): void => {
    setSearchQuery('')
    setSearching(false)
  }

  const openSearch = (): void => {
    cancelEdit()
    setSearching(true)
  }

  return (
    <aside
      className={s.wrapper}
      style={{
        top: DOC_EDITOR_SIDE_TREE_STICKY_TOP,
        height: DOC_EDITOR_SIDE_TREE_STICKY_HEIGHT,
      }}
    >
      <CoverWarningModal message={coverWarning} onClose={clearCoverWarning} />
      <Toolbar
        query={searchQuery}
        searching={searching}
        onChangeQuery={setSearchQuery}
        onCloseSearch={closeSearch}
        onOpenSearch={openSearch}
      />

      <SideTreeDndContext groups={visibleGroups} onCommit={reorderGroups}>
        {({
          activeDragColumnId,
          columns,
          targetDragColumnId,
          targetDragItemId,
          targetDragPosition,
        }) => (
          <div ref={groupListRef} className={s.groupList}>
            {searchActive && columns.length === 0 ? (
              <div className={s.empty}>{t('dsb.cms.docs.side_tree.search_empty')}</div>
            ) : (
              <SortableContext
                items={columns.map((group) => `docs-side-tree-sortable-group:${group.id}`)}
                strategy={verticalListSortingStrategy}
              >
                {columns.map((group) => {
                  const showGroupTargetLine =
                    !searching &&
                    !!activeDragColumnId &&
                    !!targetDragColumnId &&
                    targetDragColumnId === group.id &&
                    activeDragColumnId !== group.id &&
                    !targetDragItemId

                  return (
                    <Group
                      key={group.id}
                      group={group}
                      activeId={activeId}
                      editingTarget={editingTarget}
                      searchQuery={deferredSearchQuery}
                      searching={searching}
                      showTargetLine={showGroupTargetLine}
                      targetDragItemId={searching ? null : targetDragItemId}
                      targetDragPosition={searching ? null : targetDragPosition}
                      onActivate={activate}
                      onToggle={toggleGroup}
                      onAddChild={addChild}
                      onCoverGroupAction={toggleCoverGroup}
                      onPublishGroup={publishGroup}
                      onMoveGroupToDraft={moveGroupToDraft}
                      onDeleteGroup={deleteGroup}
                      onRenameGroup={renameGroup}
                      onRenameChild={renameChild}
                      onRenameLink={renameLink}
                      onCancelEdit={cancelEdit}
                      onEdit={edit}
                      onChildAction={handleChildAction}
                      onChildStyleChange={updateChildStyle}
                    />
                  )
                })}
              </SortableContext>
            )}
          </div>
        )}
      </SideTreeDndContext>
    </aside>
  )
}

export default SideTree
