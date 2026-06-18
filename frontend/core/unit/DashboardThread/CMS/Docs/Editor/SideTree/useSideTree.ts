import { useCallback, useEffect, useRef, useState } from 'react'

import useGraphQLClient from '~/hooks/useGraphQLClient'
import useQuery from '~/hooks/useQuery'
import useTrans from '~/hooks/useTrans'
import { slugify } from '~/lib/slug'
import useCommunity from '~/stores/community/hooks'
import { toast } from '~/widgets/Toaster'

import S from '../../../../schema'
import {
  SIDE_TREE_NODE_MENU_ACTION,
  SIDE_TREE_NODE_TYPE,
  UNTITLED_TITLE_I18N_KEY,
} from './constant'
import { createSideTreeChild, createSideTreeGroup, duplicateSideTreeChild } from './helper'
import type {
  TEditingTarget,
  TSideTreeChild,
  TSideTreeChildMenuAction,
  TSideTreeGroup,
  TSideTreeNodeMenuAction,
} from './spec'

export type TSideTreeController = {
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
  updateChildStyle: (groupId: string, childId: string, marker: TSideTreeChild['marker']) => void
  patchChild: (childId: string, patch: Partial<TSideTreeChild>) => void
  reorderGroups: (groups: readonly TSideTreeGroup[]) => void
}

type TDocTreeNodeDTO = {
  id: string
  parentId?: string | null
  docId?: string | null
  type: TSideTreeGroup['type'] | TSideTreeChild['type']
  title?: string | null
  slug?: string | null
  index?: number | null
  href?: string | null
  marker?: TSideTreeChild['marker'] | null
  badge?: string | null
  hidden?: boolean | null
  expanded?: boolean | null
  children?: TDocTreeNodeDTO[] | null
}

type TDocTreeMutationPayload = {
  revision: number
  conflict?: boolean | null
  node?: TDocTreeNodeDTO | null
  affectedNodes?: TDocTreeNodeDTO[] | null
}

type TDocTreeMutationData = Record<string, TDocTreeMutationPayload | null | undefined>

const formatMutationError = (err: unknown): string => {
  const graphQLErrors = (err as { graphQLErrors?: Array<{ message?: unknown }> })?.graphQLErrors

  if (Array.isArray(graphQLErrors) && graphQLErrors.length > 0) {
    return graphQLErrors
      .map((error) => {
        const { message } = error

        if (Array.isArray(message)) {
          return message
            .map((item) => {
              if (typeof item === 'string') return item
              if (item && typeof item === 'object' && 'message' in item) {
                const key = 'key' in item ? `${item.key}: ` : ''
                return `${key}${item.message}`
              }
              return JSON.stringify(item)
            })
            .join('; ')
        }

        if (typeof message === 'string') return message
        return JSON.stringify(message)
      })
      .join('; ')
  }

  return err instanceof Error ? err.message : String(err)
}

const mapNode = (node: TDocTreeNodeDTO): TSideTreeChild => {
  if (node.type === SIDE_TREE_NODE_TYPE.LINK) {
    return {
      id: node.id,
      type: SIDE_TREE_NODE_TYPE.LINK,
      title: node.title || '',
      slug: node.slug || undefined,
      href: node.href || '',
      marker: node.marker || undefined,
      badge: node.badge || undefined,
      hidden: node.hidden || undefined,
    }
  }

  return {
    id: node.id,
    type: SIDE_TREE_NODE_TYPE.PAGE,
    title: node.title || undefined,
    slug: node.slug || undefined,
    docId: node.docId || undefined,
    path: node.slug || undefined,
    href: undefined,
    marker: node.marker || undefined,
    badge: node.badge || undefined,
    hidden: node.hidden || undefined,
  }
}

const mapGroup = (node: TDocTreeNodeDTO): TSideTreeGroup => ({
  id: node.id,
  type: SIDE_TREE_NODE_TYPE.GROUP,
  title: node.title || '',
  slug: node.slug || undefined,
  marker: node.marker || undefined,
  hidden: node.hidden || undefined,
  expanded: node.expanded ?? true,
  children: (node.children || []).map(mapNode),
})

const isDraftId = (id: string): boolean =>
  id.startsWith(`${SIDE_TREE_NODE_TYPE.GROUP}-`) ||
  id.startsWith(`${SIDE_TREE_NODE_TYPE.PAGE}-`) ||
  id.startsWith(`${SIDE_TREE_NODE_TYPE.LINK}-`)

const removeDraftTarget = (
  groups: readonly TSideTreeGroup[],
  target: TEditingTarget,
): TSideTreeGroup[] | null => {
  if (!target) return null

  if (target.type === SIDE_TREE_NODE_TYPE.GROUP && isDraftId(target.groupId)) {
    return groups.filter((group) => group.id !== target.groupId)
  }

  if ('childId' in target && isDraftId(target.childId)) {
    return groups.map((group) =>
      group.id === target.groupId
        ? { ...group, children: group.children.filter((child) => child.id !== target.childId) }
        : group,
    )
  }

  return null
}

const replaceGroupId = (
  groups: readonly TSideTreeGroup[],
  localId: string,
  remote: TSideTreeGroup,
): TSideTreeGroup[] => groups.map((group) => (group.id === localId ? remote : group))

const replaceChildId = (
  groups: readonly TSideTreeGroup[],
  groupId: string,
  localId: string,
  remote: TSideTreeChild,
): TSideTreeGroup[] =>
  groups.map((group) =>
    group.id === groupId
      ? {
          ...group,
          children: group.children.map((child) => (child.id === localId ? remote : child)),
        }
      : group,
  )

const findGroupIndex = (groups: readonly TSideTreeGroup[], groupId: string): number =>
  groups.findIndex((group) => group.id === groupId)

const findChildIndex = (
  groups: readonly TSideTreeGroup[],
  groupId: string,
  childId: string,
): number => {
  const group = groups.find((item) => item.id === groupId)
  if (!group) return -1
  return group.children.findIndex((child) => child.id === childId)
}

const patchNode = (groups: readonly TSideTreeGroup[], node: TDocTreeNodeDTO): TSideTreeGroup[] => {
  if (node.type === SIDE_TREE_NODE_TYPE.GROUP) {
    return groups.map((group) => (group.id === node.id ? { ...group, ...mapGroup(node) } : group))
  }

  const child = mapNode(node)

  return groups.map((group) => ({
    ...group,
    children: group.children.map((item) => (item.id === child.id ? child : item)),
  }))
}

const findMovedNode = (
  prevGroups: readonly TSideTreeGroup[],
  nextGroups: readonly TSideTreeGroup[],
): { id: string; targetParentId: string | null; targetIndex: number } | null => {
  const prevPositions = new Map<string, { parentId: string | null; index: number }>()

  for (const [index, group] of prevGroups.entries()) {
    prevPositions.set(group.id, { parentId: null, index })
    for (const [childIndex, child] of group.children.entries()) {
      prevPositions.set(child.id, { parentId: group.id, index: childIndex })
    }
  }

  for (const [index, group] of nextGroups.entries()) {
    const prev = prevPositions.get(group.id)
    if (prev && (prev.parentId !== null || prev.index !== index)) {
      return { id: group.id, targetParentId: null, targetIndex: index }
    }

    for (const [childIndex, child] of group.children.entries()) {
      const prevChild = prevPositions.get(child.id)
      if (prevChild && (prevChild.parentId !== group.id || prevChild.index !== childIndex)) {
        return { id: child.id, targetParentId: group.id, targetIndex: childIndex }
      }
    }
  }

  return null
}

export default function useSideTree(): TSideTreeController {
  const { t } = useTrans()
  const { slug: community } = useCommunity()
  const { mutate } = useGraphQLClient()
  const { data, reload } = useQuery<{ docTree?: { revision: number; groups: TDocTreeNodeDTO[] } }>(
    S.docTree,
    { community },
  )
  const [groups, setGroups] = useState<TSideTreeGroup[]>([])
  const groupsRef = useRef<TSideTreeGroup[]>([])
  const revisionRef = useRef<number | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingTarget, setEditingTarget] = useState<TEditingTarget>(null)

  useEffect(() => {
    if (!data?.docTree) return

    const nextGroups = data.docTree.groups.map(mapGroup)
    revisionRef.current = data.docTree.revision
    groupsRef.current = nextGroups
    setGroups(nextGroups)
    setActiveId(nextGroups[0]?.children[0]?.id ?? null)
  }, [data])

  const commitGroups = useCallback((nextGroups: TSideTreeGroup[]): void => {
    groupsRef.current = nextGroups
    setGroups(nextGroups)
  }, [])

  const handlePayload = useCallback(
    (payload?: TDocTreeMutationPayload | null): boolean => {
      if (!payload) return false

      if (payload.conflict) {
        reload()
        toast('目录树已更新，请重试', 'error')
        return false
      }

      revisionRef.current = payload.revision
      return true
    },
    [reload],
  )

  const persist = useCallback(
    async (
      schema,
      variables: Record<string, unknown>,
      pickPayload: (data: TDocTreeMutationData) => TDocTreeMutationPayload | null | undefined,
    ): Promise<TDocTreeMutationPayload | null | undefined> => {
      try {
        const data = (await mutate(schema, {
          community,
          baseRevision: revisionRef.current,
          ...variables,
        })) as TDocTreeMutationData
        const payload = pickPayload(data)
        handlePayload(payload)
        return payload
      } catch (err) {
        console.error('## doc tree mutation error: ', err)
        toast(formatMutationError(err), 'error')
        reload()
        return null
      }
    },
    [community, handlePayload, mutate, reload],
  )

  const reorderGroups = useCallback(
    (nextGroups: readonly TSideTreeGroup[]): void => {
      const prevGroups = groupsRef.current
      const moved = findMovedNode(prevGroups, nextGroups)
      const localGroups = [...nextGroups]

      commitGroups(localGroups)

      if (!moved) return
      if (isDraftId(moved.id) || (moved.targetParentId && isDraftId(moved.targetParentId))) return

      persist(
        S.moveDocTreeNode,
        {
          id: moved.id,
          targetParentId: moved.targetParentId,
          targetIndex: moved.targetIndex,
        },
        (data) => data?.moveDocTreeNode,
      )
    },
    [commitGroups, persist],
  )

  /**
   * Patch group metadata while preserving child order.
   *
   * @example
   * updateGroup('group-getting-started', { title: 'Guides' })
   */
  const updateGroup = useCallback(
    (groupId: string, patch: Partial<TSideTreeGroup>): void => {
      commitGroups(
        groupsRef.current.map((group) => (group.id === groupId ? { ...group, ...patch } : group)),
      )
    },
    [commitGroups],
  )

  /**
   * Append a new empty group and start editing its title.
   *
   * @example
   * addGroup()
   */
  const addGroup = useCallback((): void => {
    const group = createSideTreeGroup(t(UNTITLED_TITLE_I18N_KEY))
    commitGroups([...groupsRef.current, group])
    setEditingTarget({ type: SIDE_TREE_NODE_TYPE.GROUP, groupId: group.id })
  }, [commitGroups, t])

  /**
   * Append a new page/link into a group, expand the group, and focus the new child.
   *
   * @example
   * addChild('group-getting-started', SIDE_TREE_CHILD_MENU_ACTION.PAGE)
   */
  const addChild = useCallback(
    (groupId: string, action: TSideTreeChildMenuAction): void => {
      const child = createSideTreeChild(action, t(UNTITLED_TITLE_I18N_KEY))

      const nextGroups = groupsRef.current.map((group) =>
        group.id === groupId
          ? { ...group, expanded: true, children: [...group.children, child] }
          : group,
      )
      commitGroups(nextGroups)
      setActiveId(child.id)
      setEditingTarget({ type: child.type, groupId, childId: child.id })
    },
    [commitGroups, t],
  )

  /**
   * Delete a group and all of its local demo children.
   *
   * @example
   * deleteGroup('group-getting-started')
   */
  const deleteGroup = useCallback(
    (groupId: string): void => {
      const group = groupsRef.current.find((item) => item.id === groupId)
      const activeInGroup = group?.children.some((child) => child.id === activeId) ?? false
      const editingInGroup = editingTarget?.groupId === groupId

      commitGroups(groupsRef.current.filter((item) => item.id !== groupId))
      if (activeInGroup) setActiveId(null)
      if (editingInGroup) setEditingTarget(null)

      if (isDraftId(groupId)) return

      persist(S.deleteDocTreeNode, { id: groupId }, (data) => data?.deleteDocTreeNode)
    },
    [activeId, commitGroups, editingTarget, persist],
  )

  /**
   * Toggle a group between expanded and collapsed states.
   *
   * @example
   * toggleGroup('group-getting-started')
   */
  const toggleGroup = useCallback(
    (groupId: string): void => {
      const group = groupsRef.current.find((item) => item.id === groupId)
      const expanded = group?.expanded === false

      commitGroups(
        groupsRef.current.map((group) =>
          group.id === groupId ? { ...group, expanded: group.expanded === false } : group,
        ),
      )

      if (isDraftId(groupId)) return

      persist(
        S.updateDocTreeNode,
        { id: groupId, patch: { expanded } },
        (data) => data?.updateDocTreeNode,
      )
    },
    [commitGroups, persist],
  )

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

      if (isDraftId(groupId)) {
        const index = findGroupIndex(groupsRef.current, groupId)
        if (index === -1) return

        slugify(title)
          .then((slug) =>
            persist(
              S.createDocTreeGroup,
              {
                input: {
                  title,
                  slug,
                  index,
                },
              },
              (data) => data?.createDocTreeGroup,
            ),
          )
          .then((payload) => {
            if (!payload?.node || payload.conflict) return
            commitGroups(replaceGroupId(groupsRef.current, groupId, mapGroup(payload.node)))
          })
          .catch((err) => {
            console.error('## doc tree create group error: ', err)
            reload()
          })
        return
      }

      slugify(title)
        .then((slug) =>
          persist(
            S.updateDocTreeNode,
            { id: groupId, patch: { title, slug } },
            (data) => data?.updateDocTreeNode,
          ),
        )
        .then((payload) => {
          if (payload?.node && !payload.conflict) {
            commitGroups(patchNode(groupsRef.current, payload.node))
          }
        })
        .catch((err) => {
          console.error('## doc tree rename group error: ', err)
          reload()
        })
    },
    [commitGroups, persist, reload, updateGroup],
  )

  /**
   * Commit a page/link title edit and leave edit mode.
   *
   * @example
   * renameChild('group-getting-started', 'page-welcome', 'Welcome')
   */
  const renameChild = useCallback(
    (groupId: string, childId: string, title: string): void => {
      commitGroups(
        groupsRef.current.map((group) =>
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

      if (isDraftId(childId)) {
        if (isDraftId(groupId)) {
          toast('请先确认分组名称', 'error')
          return
        }

        const group = groupsRef.current.find((item) => item.id === groupId)
        const child = group?.children.find((item) => item.id === childId)
        const index = findChildIndex(groupsRef.current, groupId, childId)
        if (!child || index === -1) return

        const schema =
          child.type === SIDE_TREE_NODE_TYPE.LINK ? S.createDocTreeLink : S.createDocTreePage

        slugify(title)
          .then((slug) =>
            persist(
              schema,
              {
                input: {
                  parentId: groupId,
                  title,
                  slug,
                  index,
                  href: child.type === SIDE_TREE_NODE_TYPE.LINK ? child.href : undefined,
                  marker: child.marker,
                },
              },
              (data) =>
                child.type === SIDE_TREE_NODE_TYPE.LINK
                  ? data?.createDocTreeLink
                  : data?.createDocTreePage,
            ),
          )
          .then((payload) => {
            if (!payload?.node || payload.conflict) return
            const remote = mapNode(payload.node)
            commitGroups(replaceChildId(groupsRef.current, groupId, childId, remote))
            setActiveId((current) => (current === childId ? remote.id : current))
          })
          .catch((err) => {
            console.error('## doc tree create child error: ', err)
            reload()
          })
        return
      }

      slugify(title)
        .then((slug) =>
          persist(
            S.updateDocTreeNode,
            { id: childId, patch: { title, slug } },
            (data) => data?.updateDocTreeNode,
          ),
        )
        .then((payload) => {
          if (payload?.node && !payload.conflict) {
            commitGroups(patchNode(groupsRef.current, payload.node))
          }
        })
        .catch((err) => {
          console.error('## doc tree rename child error: ', err)
          reload()
        })
    },
    [commitGroups, persist, reload],
  )

  /**
   * Cancel any active inline title editor.
   *
   * @example
   * cancelEdit()
   */
  const cancelEdit = useCallback((): void => {
    if (editingTarget) {
      const nextGroups = removeDraftTarget(groupsRef.current, editingTarget)
      const group =
        editingTarget.type === SIDE_TREE_NODE_TYPE.GROUP
          ? groupsRef.current.find((item) => item.id === editingTarget.groupId)
          : null

      if (nextGroups) {
        commitGroups(nextGroups)

        if ('childId' in editingTarget && activeId === editingTarget.childId) {
          setActiveId(null)
        }

        if (editingTarget.type === SIDE_TREE_NODE_TYPE.GROUP) {
          if (group?.children.some((child) => child.id === activeId)) {
            setActiveId(null)
          }
        }
      }
    }

    setEditingTarget(null)
  }, [activeId, commitGroups, editingTarget])

  /**
   * Update the marker style for a page or quick link.
   *
   * @example
   * updateChildStyle('group-getting-started', 'page-welcome', nextMarker)
   */
  const updateChildStyle = useCallback(
    (groupId: string, childId: string, marker: TSideTreeChild['marker']): void => {
      commitGroups(
        groupsRef.current.map((group) =>
          group.id === groupId
            ? {
                ...group,
                children: group.children.map((child) =>
                  child.id === childId ? { ...child, marker } : child,
                ),
              }
            : group,
        ),
      )

      if (isDraftId(childId)) return

      persist(
        S.updateDocTreeNode,
        { id: childId, patch: { marker } },
        (data) => data?.updateDocTreeNode,
      )
    },
    [commitGroups, persist],
  )

  const patchChild = useCallback(
    (childId: string, patch: Partial<TSideTreeChild>): void => {
      commitGroups(
        groupsRef.current.map((group) => ({
          ...group,
          children: group.children.map((child) =>
            child.id === childId ? ({ ...child, ...patch } as TSideTreeChild) : child,
          ),
        })),
      )
    },
    [commitGroups],
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
        const group = groupsRef.current.find((item) => item.id === groupId)
        const child = group?.children.find((item) => item.id === childId)
        if (!child) return
        setEditingTarget({ type: child.type, groupId, childId })
        return
      }

      let duplicatedId: string | null = null

      commitGroups(
        groupsRef.current.map((group) => {
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

          const duplicated = duplicateSideTreeChild(child, t(UNTITLED_TITLE_I18N_KEY))
          duplicatedId = duplicated.id
          const children = [...group.children]
          children.splice(childIndex + 1, 0, duplicated)

          return { ...group, children }
        }),
      )

      if (action === SIDE_TREE_NODE_MENU_ACTION.DELETE) {
        if (activeId === childId) setActiveId(null)
        if (
          editingTarget &&
          editingTarget.type !== SIDE_TREE_NODE_TYPE.GROUP &&
          editingTarget.groupId === groupId &&
          editingTarget.childId === childId
        ) {
          setEditingTarget(null)
        }

        if (isDraftId(childId)) return

        persist(S.deleteDocTreeNode, { id: childId }, (data) => data?.deleteDocTreeNode)
        return
      }

      if (action === SIDE_TREE_NODE_MENU_ACTION.DUPLICATE && duplicatedId) {
        if (isDraftId(childId)) return

        persist(S.duplicateDocTreeNode, { id: childId }, (data) => data?.duplicateDocTreeNode).then(
          (payload) => {
            if (!payload?.node || payload.conflict || !duplicatedId) return
            const remote = mapNode(payload.node)
            commitGroups(replaceChildId(groupsRef.current, groupId, duplicatedId, remote))
          },
        )
      }
    },
    [activeId, commitGroups, editingTarget, persist, t],
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
    patchChild,
    reorderGroups,
  }
}
