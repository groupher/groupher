import type { AnyVariables, DocumentInput } from '@urql/core'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import useGraphQLClient from '~/hooks/useGraphQLClient'
import useQuery from '~/hooks/useQuery'
import useTrans from '~/hooks/useTrans'
import { slugify } from '~/lib/slug'
import useCommunity from '~/stores/community/hooks'
import S from '~/unit/DashboardThread/schema'
import { toast } from '~/widgets/Toaster'

import { DOC_EDITOR_QUERY_PARAM } from '../constant'
import {
  DEFAULT_LINK_MARKER,
  SIDE_TREE_NODE_MENU_ACTION,
  SIDE_TREE_NODE_TYPE,
  UNTITLED_TITLE_I18N_KEY,
} from './constant'
import {
  appendChildToGroup,
  buildDocEditorUrl,
  createSideTreeChild,
  createSideTreeGroup,
  duplicateChildInGroup,
  findChild,
  findChildEditingTarget,
  findChildIndex,
  findFirstPage,
  findGroupIndex,
  findMovedNode,
  formatMutationError,
  getDocIdFromPage,
  getDefaultLinkTitle,
  isActiveRemovedByTarget,
  isDraftId,
  isLinkHref,
  mapGroup,
  mapNode,
  patchChildInGroups,
  patchGroupInGroups,
  patchNode,
  removeChildFromGroup,
  removeDraftTarget,
  removeGroupFromGroups,
  replaceChildId,
  replaceGroupId,
  resolveActiveIdFromUrl,
  toggleGroupExpandedInGroups,
  updateChildMarkerInGroup,
  updateChildTitleInGroup,
} from './helper'
import type {
  TDocTreeInitialData,
  TDocTreeMutationData,
  TDocTreeMutationPayload,
  TDocTreeNodeDTO,
  TEditingTarget,
  TSideTreeChild,
  TSideTreeChildMenuAction,
  TSideTreeController,
  TSideTreeGroup,
  TSideTreeLinkInput,
  TSideTreeNodeMenuAction,
} from './spec'

export default function useLogic(initialData?: TDocTreeInitialData): TSideTreeController {
  const { t } = useTrans()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchString = searchParams.toString()
  const currentDocId = searchParams.get(DOC_EDITOR_QUERY_PARAM.DOC_ID)
  const { slug: community } = useCommunity()
  const { mutate } = useGraphQLClient()
  const { data, reload } = useQuery<{ docTree?: { revision: number; groups: TDocTreeNodeDTO[] } }>(
    S.docTree,
    { community },
  )
  const initialGroups = useMemo(() => initialData?.groups.map(mapGroup) ?? [], [initialData])
  const [groups, setGroups] = useState<TSideTreeGroup[]>(initialGroups)
  const groupsRef = useRef<TSideTreeGroup[]>(initialGroups)
  const currentDocIdRef = useRef<string | null>(currentDocId)
  const revisionRef = useRef<number | null>(initialData?.revision ?? null)
  const [activeId, setActiveId] = useState<string | null>(() =>
    resolveActiveIdFromUrl(initialGroups, currentDocId),
  )
  const [editingTarget, setEditingTarget] = useState<TEditingTarget>(null)
  const [coverWarning, setCoverWarning] = useState<string | null>(null)

  function syncDocIdToUrl(docId: string | null): void {
    const nextUrl = buildDocEditorUrl(pathname, searchString, docId)
    const currentUrl = searchString ? `${pathname}?${searchString}` : pathname

    if (nextUrl === currentUrl) return

    router.replace(nextUrl, { scroll: false })
  }

  const syncActiveIdFromUrl = useCallback((sourceGroups: readonly TSideTreeGroup[]): void => {
    const docId = currentDocIdRef.current

    if (docId) {
      const nextActiveId = resolveActiveIdFromUrl(sourceGroups, docId)
      if (!nextActiveId) return

      setActiveId((current) => (current === nextActiveId ? current : nextActiveId))
      return
    }

    setActiveId((current) => {
      return current === null ? current : null
    })
  }, [])

  function selectPage(page: TSideTreeChild | null): void {
    setActiveId(page?.id ?? null)
    syncDocIdToUrl(getDocIdFromPage(page))
  }

  function readGroups(): TSideTreeGroup[] {
    return groupsRef.current
  }

  const commitGroups = useCallback((nextGroups: TSideTreeGroup[]): TSideTreeGroup[] => {
    groupsRef.current = nextGroups
    setGroups(nextGroups)
    return nextGroups
  }, [])

  function updateGroups(
    updater: (currentGroups: TSideTreeGroup[]) => TSideTreeGroup[],
  ): TSideTreeGroup[] {
    return commitGroups(updater(readGroups()))
  }

  useEffect(() => {
    currentDocIdRef.current = currentDocId
  }, [currentDocId])

  useEffect(() => {
    if (!data?.docTree) return
    if (revisionRef.current !== null && data.docTree.revision < revisionRef.current) return

    const nextGroups = data.docTree.groups.map(mapGroup)
    revisionRef.current = data.docTree.revision
    commitGroups(nextGroups)
    syncActiveIdFromUrl(nextGroups)
  }, [commitGroups, data, syncActiveIdFromUrl])

  useEffect(() => {
    syncActiveIdFromUrl(groupsRef.current)
  }, [currentDocId, syncActiveIdFromUrl])

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

        if (payload?.conflict) {
          reload()
          toast(t('dsb.cms.docs.side_tree.error.tree_conflict'), 'error')
          return payload
        }

        if (payload) revisionRef.current = payload.revision

        return payload
      } catch (err) {
        console.error('## doc tree mutation error: ', err)
        toast(formatMutationError(err), 'error')
        reload()
        return null
      }
    },
    [community, mutate, reload, t],
  )

  const persistCoverAction = useCallback(
    async (
      schema: DocumentInput<unknown, AnyVariables>,
      variables: Record<string, unknown>,
    ): Promise<boolean> => {
      try {
        await mutate(schema, { community, ...variables })
        reload()
        return true
      } catch (err) {
        const message = formatMutationError(err)
        setCoverWarning(message)
        reload()
        return false
      }
    },
    [community, mutate, reload],
  )

  function persistTitleMutation(
    title: string,
    schema: unknown,
    variables: (slug: string) => Record<string, unknown>,
    pickPayload: (data: TDocTreeMutationData) => TDocTreeMutationPayload | null | undefined,
    onSuccess: (node: TDocTreeNodeDTO) => void,
    errorLabel: string,
  ): void {
    slugify(title)
      .then((slug) => persist(schema, variables(slug), pickPayload))
      .then((payload) => {
        if (!payload?.node || payload.conflict) return
        onSuccess(payload.node)
      })
      .catch((err) => {
        console.error(`## doc tree ${errorLabel} error: `, err)
        reload()
      })
  }

  const reorderGroups = useCallback(
    (nextGroups: readonly TSideTreeGroup[]): void => {
      const prevGroups = groupsRef.current
      const moved = findMovedNode(prevGroups, nextGroups)
      const localGroups = [...nextGroups]

      // DnD commits should use the same ref/state write path as normal tree mutations.
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
  function updateGroup(groupId: string, patch: Partial<TSideTreeGroup>): void {
    updateGroups((currentGroups) => patchGroupInGroups(currentGroups, groupId, patch))
  }

  function updateChildTitle(groupId: string, childId: string, title: string): void {
    updateGroups((currentGroups) => updateChildTitleInGroup(currentGroups, groupId, childId, title))
  }

  /**
   * Append a new empty group and start editing its title.
   *
   * @example
   * addGroup()
   */
  function addGroup(): void {
    const group = createSideTreeGroup(t(UNTITLED_TITLE_I18N_KEY))
    updateGroups((currentGroups) => [...currentGroups, group])
    setEditingTarget({ type: SIDE_TREE_NODE_TYPE.GROUP, groupId: group.id })
  }

  /**
   * Append a new page/link into a group, expand the group, and focus the new child.
   *
   * @example
   * addChild('group-getting-started', SIDE_TREE_CHILD_MENU_ACTION.PAGE)
   */
  function addChild(groupId: string, action: TSideTreeChildMenuAction): void {
    const child = createSideTreeChild(action, t(UNTITLED_TITLE_I18N_KEY))

    updateGroups((currentGroups) => appendChildToGroup(currentGroups, groupId, child))
    setEditingTarget({ type: child.type, groupId, childId: child.id })
  }

  /**
   * Delete a group and all of its local demo children.
   *
   * @example
   * deleteGroup('group-getting-started')
   */
  function deleteGroup(groupId: string): void {
    const currentGroups = readGroups()
    const group = currentGroups.find((item) => item.id === groupId)
    const activeInGroup = group?.children.some((child) => child.id === activeId) ?? false
    const editingInGroup = editingTarget?.groupId === groupId
    const nextGroups = commitGroups(removeGroupFromGroups(currentGroups, groupId))

    if (activeInGroup) {
      selectPage(findFirstPage(nextGroups))
    }
    if (editingInGroup) setEditingTarget(null)

    if (isDraftId(groupId)) return

    persist(S.deleteDocTreeNode, { id: groupId }, (data) => data?.deleteDocTreeNode)
  }

  /**
   * Toggle a group between expanded and collapsed states.
   *
   * @example
   * toggleGroup('group-getting-started')
   */
  function toggleGroup(groupId: string): void {
    const { groups: nextGroups, expanded } = toggleGroupExpandedInGroups(readGroups(), groupId)

    // Keep this explicit commit because the helper also returns the persisted expanded value.
    commitGroups(nextGroups)

    if (isDraftId(groupId)) return

    persist(
      S.updateDocTreeNode,
      { id: groupId, patch: { expanded } },
      (data) => data?.updateDocTreeNode,
    )
  }

  function toggleCoverGroup(groupId: string, inCover: boolean): void {
    persistCoverAction(inCover ? S.removeDocCoverGroup : S.addDocCoverGroup, { groupId }).then(
      (ok) => {
        if (!ok) return
        toast(
          inCover
            ? t('dsb.cms.docs.side_tree.cover.removed')
            : t('dsb.cms.docs.side_tree.cover.added'),
        )
      },
    )
  }

  function publishGroup(groupId: string): void {
    mutate(S.publishDocTreeGroup, {
      community,
      groupId,
      mode: 'WITH_COVER_SYNC',
    })
      .then(() => {
        reload()
        toast(t('dsb.cms.docs.side_tree.publish.group_published'))
      })
      .catch((err) => {
        toast(formatMutationError(err), 'error')
        reload()
      })
  }

  function moveGroupToDraft(groupId: string): void {
    mutate(S.moveDocTreeGroupToDraft, { community, groupId })
      .then(() => {
        reload()
        toast(t('dsb.cms.docs.side_tree.publish.group_draft_moved'))
      })
      .catch((err) => {
        toast(formatMutationError(err), 'error')
        reload()
      })
  }

  function createDraftGroup(groupId: string, title: string): void {
    const index = findGroupIndex(readGroups(), groupId)
    if (index === -1) return

    persistTitleMutation(
      title,
      S.createDocTreeGroup,
      (slug) => ({
        input: {
          title,
          slug,
          index,
        },
      }),
      (data) => data?.createDocTreeGroup,
      (node) => {
        updateGroups((currentGroups) => replaceGroupId(currentGroups, groupId, mapGroup(node)))
      },
      'create group',
    )
  }

  function updateRemoteTitle(nodeId: string, title: string, errorLabel: string): void {
    persistTitleMutation(
      title,
      S.updateDocTreeNode,
      (slug) => ({ id: nodeId, patch: { title, slug } }),
      (data) => data?.updateDocTreeNode,
      (node) => {
        updateGroups((currentGroups) => patchNode(currentGroups, node))
      },
      errorLabel,
    )
  }

  function updateRemoteLink(nodeId: string, input: TSideTreeLinkInput): void {
    persistTitleMutation(
      input.title,
      S.updateDocTreeNode,
      (slug) => ({ id: nodeId, patch: { href: input.href, title: input.title, slug } }),
      (data) => data?.updateDocTreeNode,
      (node) => {
        updateGroups((currentGroups) => patchNode(currentGroups, node))
      },
      'rename link',
    )
  }

  function createDraftChild(groupId: string, childId: string, title: string): void {
    const currentGroups = readGroups()
    const group = currentGroups.find((item) => item.id === groupId)
    const child = group?.children.find((item) => item.id === childId)
    const index = findChildIndex(currentGroups, groupId, childId)
    if (!child || index === -1) return

    const schema =
      child.type === SIDE_TREE_NODE_TYPE.LINK ? S.createDocTreeLink : S.createDocTreePage

    persistTitleMutation(
      title,
      schema,
      (slug) => ({
        input: {
          parentId: groupId,
          title,
          slug,
          index,
          href: child.type === SIDE_TREE_NODE_TYPE.LINK ? child.href : undefined,
          marker: child.marker,
        },
      }),
      (data) =>
        child.type === SIDE_TREE_NODE_TYPE.LINK ? data?.createDocTreeLink : data?.createDocTreePage,
      (node) => {
        const remote = mapNode(node)
        updateGroups((currentGroups) => replaceChildId(currentGroups, groupId, childId, remote))
        if (remote.type === SIDE_TREE_NODE_TYPE.PAGE) selectPage(remote)
      },
      'create child',
    )
  }

  /**
   * Commit a group title edit and leave edit mode.
   *
   * @example
   * renameGroup('group-getting-started', 'Getting started')
   */
  function renameGroup(groupId: string, title: string): void {
    updateGroup(groupId, { title })
    setEditingTarget(null)

    if (isDraftId(groupId)) {
      createDraftGroup(groupId, title)
      return
    }

    updateRemoteTitle(groupId, title, 'rename group')
  }

  /**
   * Commit a page/link title edit and leave edit mode.
   *
   * @example
   * renameChild('group-getting-started', 'page-welcome', 'Welcome')
   */
  function renameChild(groupId: string, childId: string, title: string): void {
    if (isDraftId(groupId)) {
      // Keep the inline editor open so a child title cannot appear saved before its parent group exists.
      toast(t('dsb.cms.docs.side_tree.error.confirm_group_first'), 'error')
      return
    }

    const currentChild = findChild(readGroups(), childId)

    if (
      isDraftId(childId) &&
      currentChild?.type === SIDE_TREE_NODE_TYPE.PAGE &&
      isLinkHref(title)
    ) {
      const href = title.trim()
      updateGroups((currentGroups) =>
        replaceChildId(currentGroups, groupId, childId, {
          id: childId,
          type: SIDE_TREE_NODE_TYPE.LINK,
          href,
          title: getDefaultLinkTitle(href) || t(UNTITLED_TITLE_I18N_KEY),
          marker: DEFAULT_LINK_MARKER,
        }),
      )
      setEditingTarget({ type: SIDE_TREE_NODE_TYPE.LINK, groupId, childId })
      return
    }

    updateChildTitle(groupId, childId, title)
    setEditingTarget(null)

    if (isDraftId(childId)) {
      createDraftChild(groupId, childId, title)
      return
    }

    updateRemoteTitle(childId, title, 'rename child')
  }

  function renameLink(groupId: string, childId: string, input: TSideTreeLinkInput): void {
    if (isDraftId(groupId)) {
      toast(t('dsb.cms.docs.side_tree.error.confirm_group_first'), 'error')
      return
    }

    const href = input.href.trim()
    if (!isLinkHref(href)) {
      toast(t('dsb.cms.docs.side_tree.link.invalid_href'), 'error')
      return
    }

    const title = input.title.trim() || getDefaultLinkTitle(href) || t(UNTITLED_TITLE_I18N_KEY)

    updateGroups((currentGroups) => patchChildInGroups(currentGroups, childId, { href, title }))
    setEditingTarget(null)

    if (isDraftId(childId)) {
      createDraftChild(groupId, childId, title)
      return
    }

    updateRemoteLink(childId, { href, title })
  }

  /**
   * Cancel any active inline title editor.
   *
   * @example
   * cancelEdit()
   */
  function cancelEdit(): void {
    if (editingTarget) {
      const currentGroups = readGroups()
      const nextGroups = removeDraftTarget(currentGroups, editingTarget)

      if (nextGroups) {
        commitGroups(nextGroups)

        if (isActiveRemovedByTarget(currentGroups, editingTarget, activeId)) {
          selectPage(findFirstPage(nextGroups))
        }
      }
    }

    setEditingTarget(null)
  }

  /**
   * Update the marker style for a page or quick link.
   *
   * @example
   * updateChildStyle('group-getting-started', 'page-welcome', nextMarker)
   */
  function updateChildStyle(
    groupId: string,
    childId: string,
    marker: TSideTreeChild['marker'],
  ): void {
    updateGroups((currentGroups) =>
      updateChildMarkerInGroup(currentGroups, groupId, childId, marker),
    )

    if (isDraftId(childId)) return

    persist(
      S.updateDocTreeNode,
      { id: childId, patch: { marker } },
      (data) => data?.updateDocTreeNode,
    )
  }

  function patchChild(childId: string, patch: Partial<TSideTreeChild>): void {
    updateGroups((currentGroups) => patchChildInGroups(currentGroups, childId, patch))
  }

  function startRenameChild(groupId: string, childId: string): void {
    const target = findChildEditingTarget(readGroups(), groupId, childId)
    if (!target) return

    setEditingTarget(target)
  }

  function deleteChild(groupId: string, childId: string): void {
    const nextGroups = updateGroups((currentGroups) =>
      removeChildFromGroup(currentGroups, groupId, childId),
    )

    if (activeId === childId) {
      selectPage(findFirstPage(nextGroups))
    }
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
  }

  function duplicateChild(groupId: string, childId: string): void {
    const { groups: nextGroups, duplicatedId } = duplicateChildInGroup(
      readGroups(),
      groupId,
      childId,
      t(UNTITLED_TITLE_I18N_KEY),
    )

    if (!duplicatedId) return

    commitGroups(nextGroups)

    if (isDraftId(childId)) return

    persist(S.duplicateDocTreeNode, { id: childId }, (data) => data?.duplicateDocTreeNode)
      .then((payload) => {
        if (!payload?.node || payload.conflict || !duplicatedId) return
        const remote = mapNode(payload.node)
        updateGroups((currentGroups) =>
          replaceChildId(currentGroups, groupId, duplicatedId, remote),
        )
      })
      .catch((err) => {
        console.error('## doc tree duplicate child error: ', err)
        reload()
      })
  }

  /**
   * Handle row action-menu events: rename starts editing, duplicate inserts a copy,
   * and delete removes the child.
   *
   * @example
   * handleChildAction('group-getting-started', 'page-welcome', SIDE_TREE_NODE_MENU_ACTION.DUPLICATE)
   */
  function handleChildAction(
    groupId: string,
    childId: string,
    action: TSideTreeNodeMenuAction,
  ): void {
    if (action === SIDE_TREE_NODE_MENU_ACTION.RENAME) {
      startRenameChild(groupId, childId)
      return
    }

    if (action === SIDE_TREE_NODE_MENU_ACTION.DELETE) {
      deleteChild(groupId, childId)
      return
    }

    if (action === SIDE_TREE_NODE_MENU_ACTION.DUPLICATE) {
      duplicateChild(groupId, childId)
      return
    }

    if (action === SIDE_TREE_NODE_MENU_ACTION.MOVE_TO_DRAFT) {
      mutate(S.moveDocToDraft, { community, id: childId })
        .then(() => {
          reload()
          toast(t('dsb.cms.docs.side_tree.publish.draft_moved'))
        })
        .catch((err) => {
          toast(formatMutationError(err), 'error')
          reload()
        })
      return
    }

    if (
      action === SIDE_TREE_NODE_MENU_ACTION.HIDE_FROM_COVER ||
      action === SIDE_TREE_NODE_MENU_ACTION.SHOW_IN_COVER
    ) {
      persistCoverAction(S.setDocCoverItemHidden, {
        nodeId: childId,
        hidden: action === SIDE_TREE_NODE_MENU_ACTION.HIDE_FROM_COVER,
      }).then((ok) => {
        if (!ok) return
        toast(
          action === SIDE_TREE_NODE_MENU_ACTION.HIDE_FROM_COVER
            ? t('dsb.cms.docs.side_tree.cover.hidden')
            : t('dsb.cms.docs.side_tree.cover.shown'),
        )
      })
    }
  }

  function activate(id: string): void {
    const child = findChild(readGroups(), id)

    if (child?.type === SIDE_TREE_NODE_TYPE.LINK) {
      return
    }

    // Route through selectPage so active state and URL stay coupled for stale ids too.
    selectPage(child)
  }

  return {
    groups,
    activeId,
    editingTarget,
    coverWarning,
    activate,
    addGroup,
    addChild,
    clearCoverWarning: () => setCoverWarning(null),
    deleteGroup,
    toggleGroup,
    toggleCoverGroup,
    publishGroup,
    moveGroupToDraft,
    renameGroup,
    renameChild,
    renameLink,
    cancelEdit,
    edit: setEditingTarget,
    handleChildAction,
    updateChildStyle,
    patchChild,
    reload,
    reorderGroups,
  }
}
