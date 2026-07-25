'use client'

import { useAutoAnimate } from '@formkit/auto-animate/react'
import { type FC, useDeferredValue, useMemo, useState } from 'react'

import { cn } from '~/css'
import useTrans from '~/hooks/useTrans'

import { DOC_EDITOR_SIDE_TREE_STICKY_TOP } from '../salon/layout'
import { SIDE_TREE_NODE_TYPE } from './constant'
import CoverWarningModal from './CoverWarningModal'
import { SIDE_TREE_DND_LANE } from './Dnd/constant'
import SideTreeDndContext from './Dnd/SideTreeDndContext'
import SortableSideTreeGroup from './Dnd/SortableSideTreeGroup'
import Footer from './Footer'
import Group from './Group'
import PinList from './PinList'
import useSalon, { SIDE_TREE_CLASS } from './salon'
import { SIDE_TREE_SPACING } from './salon/constant'
import type { TSideTreeController, TSideTreeGroup, TSideTreeNavigationNode } from './spec'
import Toolbar from './Toolbar'
import useStickyViewportHeight from './useStickyViewportHeight'

const GROUP_LAYOUT_TRANSITION = {
  duration: 180,
  easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
} as const

type TProps = {
  controller: TSideTreeController
  viewportLayoutKey: string
}

const normalizeSearchQuery = (query: string): string => query.trim().toLowerCase()

const filterGroupsByDocTitle = (
  groups: readonly TSideTreeGroup[],
  query: string,
): TSideTreeGroup[] => {
  const normalizedQuery = normalizeSearchQuery(query)

  if (!normalizedQuery) return [...groups]

  return groups.flatMap((group) => {
    const matchingNestedGroups = filterGroupsByDocTitle(
      group.pages.filter(
        (child): child is TSideTreeGroup => child.type === SIDE_TREE_NODE_TYPE.GROUP,
      ),
      normalizedQuery,
    )
    const nestedById = new Map(matchingNestedGroups.map((child) => [child.id, child]))
    const pages: TSideTreeNavigationNode[] = []

    for (const child of group.pages) {
      if (child.type === SIDE_TREE_NODE_TYPE.GROUP) {
        const nested = nestedById.get(child.id)
        if (nested) pages.push(nested)
        continue
      }

      if ((child.title || '').toLowerCase().includes(normalizedQuery)) pages.push(child)
    }

    if (pages.length === 0) return []

    return [{ ...group, expanded: true, pages }]
  })
}

const SideTree: FC<TProps> = ({ controller, viewportLayoutKey }) => {
  const s = useSalon()
  const { t } = useTrans()
  const stickyViewportRef = useStickyViewportHeight(
    DOC_EDITOR_SIDE_TREE_STICKY_TOP,
    viewportLayoutKey,
  )
  const [groupListRef] = useAutoAnimate(GROUP_LAYOUT_TRANSITION)
  const [searching, setSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const {
    groups,
    activeTabId,
    pins,
    activeId,
    editingTarget,
    coverWarning,
    activate,
    addPin,
    addGroup,
    addChild,
    clearCoverWarning,
    deleteGroup,
    toggleGroup,
    toggleCoverGroup,
    renameGroup,
    renameChild,
    renameLink,
    savePin,
    deletePin,
    cancelEdit,
    edit,
    handleChildAction,
    updateChildStyle,
    updatePinStyle,
    reload,
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
      ref={stickyViewportRef}
      className={s.wrapper}
      style={{
        top: DOC_EDITOR_SIDE_TREE_STICKY_TOP,
      }}
    >
      <CoverWarningModal message={coverWarning} onClose={clearCoverWarning} />
      <Toolbar
        query={searchQuery}
        searching={searching}
        onChangeQuery={setSearchQuery}
        onCloseSearch={closeSearch}
        onAddPin={addPin}
        onAddGroup={addGroup}
        onOpenSearch={openSearch}
      />

      <SideTreeDndContext
        groups={visibleGroups}
        rootParentNodeId={activeTabId || ''}
        onCommit={reorderGroups}
      >
        {({ columns, target }) => (
          <div className={s.groupList}>
            <PinList
              pins={pins}
              editingTarget={editingTarget}
              onCancelEdit={cancelEdit}
              onDelete={deletePin}
              onEdit={edit}
              onSave={savePin}
              onStyleChange={updatePinStyle}
            />
            {searchActive && columns.length === 0 ? (
              <div className={s.empty}>{t('dsb.cms.docs.side_tree.search_empty')}</div>
            ) : (
              <SortableSideTreeGroup
                className={cn(
                  SIDE_TREE_CLASS.topLevelGroupList,
                  SIDE_TREE_SPACING.TOP_LEVEL_GROUP_GAP,
                )}
                depth={0}
                disabled={searching || !activeTabId}
                externalListRef={groupListRef}
                ids={columns.map((group) => group.id)}
                lane={SIDE_TREE_DND_LANE.GROUPS}
                parentNodeId={activeTabId || ''}
                targetInside={
                  target?.intent === 'inside' && target.parentNodeId === (activeTabId || '')
                }
              >
                {columns.map((group, groupIndex) => (
                  <Group
                    key={group.id}
                    group={group}
                    coveredByAncestor={false}
                    activeId={activeId}
                    depth={0}
                    editingTarget={editingTarget}
                    index={groupIndex}
                    searchQuery={deferredSearchQuery}
                    searching={searching}
                    target={searching ? null : target}
                    onActivate={activate}
                    onToggle={toggleGroup}
                    onAddNestedGroup={controller.addNestedGroup}
                    onAddChild={addChild}
                    onCoverGroupAction={toggleCoverGroup}
                    onDeleteGroup={deleteGroup}
                    onRenameGroup={renameGroup}
                    onRenameChild={renameChild}
                    onRenameLink={renameLink}
                    onCancelEdit={cancelEdit}
                    onEdit={edit}
                    onChildAction={handleChildAction}
                    onChildStyleChange={updateChildStyle}
                  />
                ))}
              </SortableSideTreeGroup>
            )}
          </div>
        )}
      </SideTreeDndContext>
      <Footer
        baseRevision={controller.treeState?.revision ?? null}
        tabs={controller.tabs}
        trashItems={controller.trashItems}
        trashLoading={controller.trashLoading}
        onReloadTrash={controller.reloadTrash}
        onRestored={reload}
      />
    </aside>
  )
}

export default SideTree
