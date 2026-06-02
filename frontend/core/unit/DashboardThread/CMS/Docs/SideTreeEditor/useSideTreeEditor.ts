import { useCallback, useState } from 'react'

import { DEMO_SIDE_TREE_GROUPS, SIDE_TREE_NODE_MENU_ACTION, SIDE_TREE_NODE_TYPE } from './constant'
import {
  cloneDemoGroups,
  createSideTreeChild,
  createSideTreeGroup,
  duplicateSideTreeChild,
} from './helper'
import type {
  TEditingTarget,
  TSideTreeChild,
  TSideTreeChildMenuAction,
  TSideTreeGroup,
  TSideTreeNodeMenuAction,
} from './spec'

type TRet = {
  groups: TSideTreeGroup[]
  activeId: string | null
  editingTarget: TEditingTarget
  activate: (id: string) => void
  addGroup: () => void
  addChild: (groupId: string, action: TSideTreeChildMenuAction) => void
  deleteGroup: (groupId: string) => void
  toggleGroup: (groupId: string) => void
  renameGroup: (groupId: string, title: string) => void
  renameChild: (groupId: string, childId: string, title: string) => void
  cancelEdit: () => void
  edit: (target: TEditingTarget) => void
  handleChildAction: (groupId: string, childId: string, action: TSideTreeNodeMenuAction) => void
  updateChildStyle: (groupId: string, childId: string, icon: TSideTreeChild['icon']) => void
  reorderGroups: (groups: readonly TSideTreeGroup[]) => void
}

export default function useSideTreeEditor(): TRet {
  const [groups, setGroups] = useState<TSideTreeGroup[]>(cloneDemoGroups)
  const [activeId, setActiveId] = useState<string | null>(
    DEMO_SIDE_TREE_GROUPS[0]?.children[0]?.id ?? null,
  )
  const [editingTarget, setEditingTarget] = useState<TEditingTarget>(null)

  const reorderGroups = useCallback((nextGroups: readonly TSideTreeGroup[]): void => {
    setGroups([...nextGroups])
  }, [])

  /**
   * Patch group metadata while preserving child order.
   *
   * @example
   * updateGroup('group-getting-started', { title: 'Guides' })
   */
  const updateGroup = useCallback((groupId: string, patch: Partial<TSideTreeGroup>): void => {
    setGroups((items) =>
      items.map((group) => (group.id === groupId ? { ...group, ...patch } : group)),
    )
  }, [])

  /**
   * Append a new empty group and start editing its title.
   *
   * @example
   * addGroup()
   */
  const addGroup = useCallback((): void => {
    const group = createSideTreeGroup()
    setGroups((items) => [...items, group])
    setEditingTarget({ type: SIDE_TREE_NODE_TYPE.GROUP, groupId: group.id })
  }, [])

  /**
   * Append a new page/link into a group, expand the group, and focus the new child.
   *
   * @example
   * addChild('group-getting-started', SIDE_TREE_CHILD_MENU_ACTION.PAGE)
   */
  const addChild = useCallback((groupId: string, action: TSideTreeChildMenuAction): void => {
    const child = createSideTreeChild(action)

    setGroups((items) =>
      items.map((group) =>
        group.id === groupId
          ? { ...group, expanded: true, children: [...group.children, child] }
          : group,
      ),
    )
    setActiveId(child.id)
    setEditingTarget({ type: child.type, groupId, childId: child.id })
  }, [])

  /**
   * Delete a group and all of its local demo children.
   *
   * @example
   * deleteGroup('group-getting-started')
   */
  const deleteGroup = useCallback(
    (groupId: string): void => {
      const group = groups.find((item) => item.id === groupId)
      const activeInGroup = group?.children.some((child) => child.id === activeId) ?? false
      const editingInGroup = editingTarget?.groupId === groupId

      setGroups((items) => items.filter((item) => item.id !== groupId))
      if (activeInGroup) setActiveId(null)
      if (editingInGroup) setEditingTarget(null)
    },
    [activeId, editingTarget, groups],
  )

  /**
   * Toggle a group between expanded and collapsed states.
   *
   * @example
   * toggleGroup('group-getting-started')
   */
  const toggleGroup = useCallback((groupId: string): void => {
    setGroups((items) =>
      items.map((group) =>
        group.id === groupId ? { ...group, expanded: group.expanded === false } : group,
      ),
    )
  }, [])

  /**
   * Commit a group title edit and leave edit mode.
   *
   * @example
   * renameGroup('group-getting-started', 'Getting started')
   */
  const renameGroup = useCallback(
    (groupId: string, title: string): void => {
      updateGroup(groupId, { title })
      setEditingTarget(null)
    },
    [updateGroup],
  )

  /**
   * Commit a page/link title edit and leave edit mode.
   *
   * @example
   * renameChild('group-getting-started', 'page-welcome', 'Welcome')
   */
  const renameChild = useCallback((groupId: string, childId: string, title: string): void => {
    setGroups((items) =>
      items.map((group) =>
        group.id === groupId
          ? {
              ...group,
              children: group.children.map((child) =>
                child.id === childId ? { ...child, title } : child,
              ),
            }
          : group,
      ),
    )
    setEditingTarget(null)
  }, [])

  /**
   * Cancel any active inline title editor.
   *
   * @example
   * cancelEdit()
   */
  const cancelEdit = useCallback((): void => {
    setEditingTarget(null)
  }, [])

  /**
   * Update the icon/color/emoji style for a page or quick link.
   *
   * @example
   * updateChildStyle('group-getting-started', 'page-welcome', nextIcon)
   */
  const updateChildStyle = useCallback(
    (groupId: string, childId: string, icon: TSideTreeChild['icon']): void => {
      setGroups((items) =>
        items.map((group) =>
          group.id === groupId
            ? {
                ...group,
                children: group.children.map((child) =>
                  child.id === childId ? { ...child, icon } : child,
                ),
              }
            : group,
        ),
      )
    },
    [],
  )

  /**
   * Handle row action-menu events: rename starts editing, duplicate inserts a copy,
   * and delete removes the child.
   *
   * @example
   * handleChildAction('group-getting-started', 'page-welcome', SIDE_TREE_NODE_MENU_ACTION.DUPLICATE)
   */
  const handleChildAction = useCallback(
    (groupId: string, childId: string, action: TSideTreeNodeMenuAction): void => {
      if (action === SIDE_TREE_NODE_MENU_ACTION.RENAME) {
        const group = groups.find((item) => item.id === groupId)
        const child = group?.children.find((item) => item.id === childId)
        if (!child) return
        setEditingTarget({ type: child.type, groupId, childId })
        return
      }

      setGroups((items) =>
        items.map((group) => {
          if (group.id !== groupId) return group

          if (action === SIDE_TREE_NODE_MENU_ACTION.DELETE) {
            return {
              ...group,
              children: group.children.filter((child) => child.id !== childId),
            }
          }

          const childIndex = group.children.findIndex((child) => child.id === childId)
          const child = group.children[childIndex]
          if (childIndex === -1 || !child) return group

          const duplicated = duplicateSideTreeChild(child)
          const children = [...group.children]
          children.splice(childIndex + 1, 0, duplicated)

          return { ...group, children }
        }),
      )

      if (activeId === childId && action === SIDE_TREE_NODE_MENU_ACTION.DELETE) setActiveId(null)
    },
    [activeId, groups],
  )

  return {
    groups,
    activeId,
    editingTarget,
    activate: setActiveId,
    addGroup,
    addChild,
    deleteGroup,
    toggleGroup,
    renameGroup,
    renameChild,
    cancelEdit,
    edit: setEditingTarget,
    handleChildAction,
    updateChildStyle,
    reorderGroups,
  }
}
