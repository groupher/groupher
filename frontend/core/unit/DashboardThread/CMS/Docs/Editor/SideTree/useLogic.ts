import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ARTICLE_STAGE, type TArticleStage } from '~/const/article'
import { DSB_DOC_EVENT } from '~/const/dsb/docs'
import useGraphQLClient from '~/hooks/useGraphQLClient'
import useQuery from '~/hooks/useQuery'
import useTrans from '~/hooks/useTrans'
import { send } from '~/lib/signal'
import { slugify } from '~/lib/slug'
import useCommunity from '~/stores/community/hooks'
import S from '~/unit/DashboardThread/schema'
import { toast } from '~/widgets/Toaster'

import { reloadDocPublishChecklist } from '../helper'
import {
  DEFAULT_LINK_MARKER,
  SIDE_TREE_NODE_MENU_ACTION,
  SIDE_TREE_NODE_TYPE,
  UNTITLED_TITLE_I18N_KEY,
} from './constant'
import {
  appendChildToGroup,
  createSideTreeChild,
  createSideTreeGroup,
  createSideTreePin,
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
  isLocalId,
  isLinkHref,
  mapGroup,
  mapNode,
  mapPin,
  patchChildInGroups,
  patchGroupInGroups,
  patchNode,
  removeChildFromGroup,
  removeLocalTarget,
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
  TDocTreeEvent,
  TDocTreeMutationData,
  TDocTreeMutationPayload,
  TDocTreeNodeDTO,
  TDocTreeNodePublishState,
  TDocTreeState,
  TDocTreeTrashData,
  TEditingTarget,
  TSideTreeChild,
  TSideTreeChildMenuAction,
  TSideTreeController,
  TSideTreeGroup,
  TSideTreeLinkInput,
  TSideTreeNodeMenuAction,
  TSideTreePin,
  TSideTreeTab,
} from './spec'
import useDocEditorUrl from './useDocEditorUrl'
import useSideTreePersistence, { type TSideTreeMutationSchema } from './usePersistence'

type TMoveDocToDraftData = {
  moveDocToDraft?: {
    docId?: string | null
    stage?: TArticleStage | null
    publishState?: TDocTreeNodePublishState | null
  } | null
}

type TLocalCreateState = {
  deleteRequested: boolean
}

const hasLocalNode = (groups: readonly TSideTreeGroup[], pins: readonly TSideTreePin[]): boolean =>
  pins.some((pin) => isLocalId(pin.id)) ||
  groups.some((group) => isLocalId(group.id) || group.children.some((child) => isLocalId(child.id)))

const mapTab = (node: TDocTreeNodeDTO): TSideTreeTab => ({
  id: node.id,
  title: node.title || '',
  slug: node.slug || undefined,
  pins: (node.pins || []).map(mapPin),
  groups: (node.groups || []).map(mapGroup),
})

const findTabByDocId = (tabs: readonly TSideTreeTab[], docId: string | null): TSideTreeTab | null =>
  tabs.find((tab) => resolveActiveIdFromUrl(tab.groups, docId) !== null) ?? null

export default function useLogic(initialData?: TDocTreeInitialData): TSideTreeController {
  const { t } = useTrans()
  const { currentDocId, syncDocIdToUrl } = useDocEditorUrl()
  const { slug: community } = useCommunity()
  const { mutate } = useGraphQLClient()
  const { data, reload } = useQuery<{
    docTree?: {
      revision: number
      treeState?: TDocTreeState | null
      stagedEvents?: TDocTreeEvent[] | null
      tabs: TDocTreeNodeDTO[]
    }
  }>(S.docTree, { community })
  const {
    data: trashData,
    loading: trashLoading,
    reload: reloadTrash,
  } = useQuery<TDocTreeTrashData>(S.docTreeTrashItems, { community })
  const trashItems = trashData?.docTreeTrashItems ?? []
  const initialTabs = useMemo(() => initialData?.tabs.map(mapTab) ?? [], [initialData])
  const initialActiveTab = findTabByDocId(initialTabs, currentDocId) ?? initialTabs[0] ?? null
  const [tabs, setTabs] = useState<TSideTreeTab[]>(initialTabs)
  const [activeTabId, setActiveTabId] = useState<string | null>(initialActiveTab?.id ?? null)
  const initialPins = initialActiveTab?.pins ?? []
  const initialGroups = initialActiveTab?.groups ?? []
  const [pins, setPins] = useState<TSideTreePin[]>(initialPins)
  const [groups, setGroups] = useState<TSideTreeGroup[]>(initialGroups)
  const [treeState, setTreeState] = useState<TDocTreeState | null>(initialData?.treeState ?? null)
  const [stagedEvents, setStagedEvents] = useState<TDocTreeEvent[]>(initialData?.stagedEvents ?? [])
  const pinsRef = useRef<TSideTreePin[]>(initialPins)
  const groupsRef = useRef<TSideTreeGroup[]>(initialGroups)
  const currentDocIdRef = useRef<string | null>(currentDocId)
  const revisionRef = useRef<number | null>(initialData?.revision ?? null)
  // Tracks only frontend-local ids while their backend draft create mutation is pending.
  // Backend draft nodes already have real ids, never enter this map, and remain Trash-restorable.
  const localCreateStateRef = useRef(new Map<string, TLocalCreateState>())
  const [activeId, setActiveId] = useState<string | null>(
    () =>
      resolveActiveIdFromUrl(initialGroups, currentDocId) ??
      findFirstPage(initialGroups)?.id ??
      null,
  )
  const [editingTarget, setEditingTarget] = useState<TEditingTarget>(null)
  const [coverWarning, setCoverWarning] = useState<string | null>(null)
  const { persist, persistCoverAction } = useSideTreePersistence({
    revisionRef,
    setTreeState,
    setCoverWarning,
    reload,
  })

  function persistDelete(nodeId: string): void {
    persist(S.deleteDocTreeNode, { id: nodeId }, (data) => data?.deleteDocTreeNode).then(
      (payload) => {
        if (!payload || payload.conflict) return
        reloadTrash()
      },
    )
  }

  const syncActiveIdFromUrl = useCallback((sourceGroups: readonly TSideTreeGroup[]): void => {
    const docId = currentDocIdRef.current

    if (docId) {
      const nextActiveId = resolveActiveIdFromUrl(sourceGroups, docId)
      if (!nextActiveId) {
        const fallback = findFirstPage(sourceGroups)

        setActiveId((current) => (current === fallback?.id ? current : (fallback?.id ?? null)))
        return
      }

      setActiveId((current) => (current === nextActiveId ? current : nextActiveId))
      return
    }

    setActiveId((current) => {
      const fallback = findFirstPage(sourceGroups)
      return current === fallback?.id ? current : (fallback?.id ?? null)
    })
  }, [])

  function selectPage(page: TSideTreeChild | null): void {
    setActiveId(page?.id ?? null)
    syncDocIdToUrl(getDocIdFromPage(page))
  }

  function readGroups(): TSideTreeGroup[] {
    return groupsRef.current
  }

  function readPins(): TSideTreePin[] {
    return pinsRef.current
  }

  const commitPins = useCallback(
    (nextPins: TSideTreePin[]): TSideTreePin[] => {
      pinsRef.current = nextPins
      setPins(nextPins)
      setTabs((currentTabs) =>
        currentTabs.map((tab) => (tab.id === activeTabId ? { ...tab, pins: nextPins } : tab)),
      )
      return nextPins
    },
    [activeTabId],
  )

  const commitGroups = useCallback(
    (nextGroups: TSideTreeGroup[]): TSideTreeGroup[] => {
      groupsRef.current = nextGroups
      setGroups(nextGroups)
      setTabs((currentTabs) =>
        currentTabs.map((tab) => (tab.id === activeTabId ? { ...tab, groups: nextGroups } : tab)),
      )
      return nextGroups
    },
    [activeTabId],
  )

  function updateGroups(
    updater: (currentGroups: TSideTreeGroup[]) => TSideTreeGroup[],
  ): TSideTreeGroup[] {
    return commitGroups(updater(readGroups()))
  }

  function updatePins(updater: (currentPins: TSideTreePin[]) => TSideTreePin[]): TSideTreePin[] {
    return commitPins(updater(readPins()))
  }

  useEffect(() => {
    currentDocIdRef.current = currentDocId
  }, [currentDocId])

  useEffect(() => {
    if (!data?.docTree) return
    if (revisionRef.current !== null && data.docTree.revision < revisionRef.current) return

    revisionRef.current = data.docTree.revision
    setTreeState(data.docTree.treeState ?? null)
    setStagedEvents(data.docTree.stagedEvents ?? [])

    if (hasLocalNode(groupsRef.current, pinsRef.current)) return

    const nextTabs = data.docTree.tabs.map(mapTab)
    const nextActiveTab =
      findTabByDocId(nextTabs, currentDocIdRef.current) ??
      nextTabs.find((tab) => tab.id === activeTabId) ??
      nextTabs[0] ??
      null
    const nextGroups = nextActiveTab?.groups ?? []
    const nextPins = nextActiveTab?.pins ?? []
    setTabs(nextTabs)
    setActiveTabId(nextActiveTab?.id ?? null)
    pinsRef.current = nextPins
    setPins(nextPins)
    commitGroups(nextGroups)
    syncActiveIdFromUrl(nextGroups)
  }, [commitGroups, data, syncActiveIdFromUrl])

  useEffect(() => {
    syncActiveIdFromUrl(groupsRef.current)
  }, [currentDocId, syncActiveIdFromUrl])

  function persistTitleMutation(
    title: string,
    schema: TSideTreeMutationSchema,
    variables: (slug: string) => Record<string, unknown>,
    pickPayload: (data: TDocTreeMutationData) => TDocTreeMutationPayload | null | undefined,
    onSuccess: (node: TDocTreeNodeDTO) => void,
    errorLabel: string,
    onSettled?: () => void,
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
      .finally(onSettled)
  }

  function persistLocalNode(
    localId: string,
    title: string,
    schema: TSideTreeMutationSchema,
    variables: (slug: string) => Record<string, unknown>,
    pickPayload: (data: TDocTreeMutationData) => TDocTreeMutationPayload | null | undefined,
    onCreated: (node: TDocTreeNodeDTO) => void,
    errorLabel: string,
  ): void {
    if (localCreateStateRef.current.has(localId)) return

    const createState: TLocalCreateState = { deleteRequested: false }
    localCreateStateRef.current.set(localId, createState)

    persistTitleMutation(
      title,
      schema,
      variables,
      pickPayload,
      (node) => {
        if (createState.deleteRequested) {
          persistDelete(node.id)
          return
        }

        onCreated(node)
      },
      errorLabel,
      () => localCreateStateRef.current.delete(localId),
    )
  }

  function requestLocalDelete(localId: string): void {
    const createState = localCreateStateRef.current.get(localId)
    if (createState) createState.deleteRequested = true
  }

  const reorderGroups = useCallback(
    (nextGroups: readonly TSideTreeGroup[]): void => {
      const prevGroups = groupsRef.current
      const moved = findMovedNode(prevGroups, nextGroups)
      const localGroups = [...nextGroups]

      // DnD commits should use the same ref/state write path as normal tree mutations.
      commitGroups(localGroups)

      if (!moved) return
      if (isLocalId(moved.id) || (moved.targetGroupId && isLocalId(moved.targetGroupId))) return

      persist(
        S.moveDocTreeNode,
        {
          id: moved.id,
          targetGroupId: moved.targetGroupId,
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

  function addPin(): void {
    if (!activeTabId) return
    if (editingTarget?.type === SIDE_TREE_NODE_TYPE.PIN && isLocalId(editingTarget.pinId)) return

    cancelEdit()
    const pin = createSideTreePin(t(UNTITLED_TITLE_I18N_KEY))
    updatePins((currentPins) => [...currentPins, pin])
    setEditingTarget({ type: SIDE_TREE_NODE_TYPE.PIN, pinId: pin.id })
  }

  /**
   * Append a new empty group and start editing its title.
   *
   * @example
   * addGroup()
   */
  function addGroup(): void {
    if (!activeTabId) return
    const group = createSideTreeGroup(t(UNTITLED_TITLE_I18N_KEY))
    group.tabId = activeTabId
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
   * Delete a group and all of its children.
   *
   * @example
   * deleteGroup('group-getting-started')
   */
  function deleteGroup(groupId: string): void {
    const currentGroups = readGroups()
    const group = currentGroups.find((item) => item.id === groupId)
    const activeInGroup = group?.children.some((child) => child.id === activeId) ?? false
    const editingInGroup =
      !!editingTarget && 'groupId' in editingTarget && editingTarget.groupId === groupId
    const nextGroups = commitGroups(removeGroupFromGroups(currentGroups, groupId))

    if (activeInGroup) {
      selectPage(findFirstPage(nextGroups))
    }
    if (editingInGroup) setEditingTarget(null)

    if (isLocalId(groupId)) {
      requestLocalDelete(groupId)
      return
    }

    persistDelete(groupId)
  }

  /**
   * Toggle a group between expanded and collapsed states.
   *
   * @example
   * toggleGroup('group-getting-started')
   */
  function toggleGroup(groupId: string): void {
    const { groups: nextGroups } = toggleGroupExpandedInGroups(readGroups(), groupId)
    commitGroups(nextGroups)
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

  function persistLocalGroup(groupId: string, title: string): void {
    const index = findGroupIndex(readGroups(), groupId)
    if (index === -1) return

    persistLocalNode(
      groupId,
      title,
      S.createDocTreeGroup,
      (slug) => ({
        input: {
          title,
          slug,
          index,
          tabId: activeTabId,
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

  function persistLocalPin(pinId: string, input: TSideTreeLinkInput): void {
    const pin = readPins().find((item) => item.id === pinId)
    const index = readPins().findIndex((item) => item.id === pinId)
    if (!pin || index === -1 || !activeTabId) return

    persistLocalNode(
      pinId,
      input.title,
      S.createDocTreePin,
      (slug) => ({
        input: {
          tabId: activeTabId,
          title: input.title,
          slug,
          href: input.href,
          index,
          marker: pin.marker,
        },
      }),
      (data) => data?.createDocTreePin,
      (node) => {
        updatePins((currentPins) =>
          currentPins.map((item) => (item.id === pinId ? mapPin(node) : item)),
        )
      },
      'create pin',
    )
  }

  function updateRemotePin(pinId: string, input: TSideTreeLinkInput): void {
    persistTitleMutation(
      input.title,
      S.updateDocTreeNode,
      (slug) => ({ id: pinId, patch: { href: input.href, title: input.title, slug } }),
      (data) => data?.updateDocTreeNode,
      (node) => {
        updatePins((currentPins) =>
          currentPins.map((item) => (item.id === pinId ? mapPin(node) : item)),
        )
      },
      'update pin',
    )
  }

  function savePin(pinId: string, input: TSideTreeLinkInput): void {
    const href = input.href.trim()
    if (!isLinkHref(href)) {
      toast(t('dsb.cms.docs.side_tree.link.invalid_href'), 'error')
      return
    }

    const title = input.title.trim() || getDefaultLinkTitle(href) || t(UNTITLED_TITLE_I18N_KEY)
    updatePins((currentPins) =>
      currentPins.map((pin) => (pin.id === pinId ? { ...pin, href, title } : pin)),
    )
    setEditingTarget(null)

    if (isLocalId(pinId)) {
      persistLocalPin(pinId, { href, title })
      return
    }

    updateRemotePin(pinId, { href, title })
  }

  function deletePin(pinId: string): void {
    updatePins((currentPins) => currentPins.filter((pin) => pin.id !== pinId))
    if (editingTarget?.type === SIDE_TREE_NODE_TYPE.PIN && editingTarget.pinId === pinId) {
      setEditingTarget(null)
    }

    if (isLocalId(pinId)) {
      requestLocalDelete(pinId)
      return
    }

    persistDelete(pinId)
  }

  function updatePinStyle(pinId: string, marker: TSideTreePin['marker']): void {
    updatePins((currentPins) =>
      currentPins.map((pin) => (pin.id === pinId ? { ...pin, marker } : pin)),
    )

    if (isLocalId(pinId)) return

    persist(
      S.updateDocTreeNode,
      { id: pinId, patch: { marker } },
      (data) => data?.updateDocTreeNode,
    )
  }

  function persistLocalChild(groupId: string, childId: string, title: string): void {
    const currentGroups = readGroups()
    const group = currentGroups.find((item) => item.id === groupId)
    const child = group?.children.find((item) => item.id === childId)
    const index = findChildIndex(currentGroups, groupId, childId)
    if (!child || index === -1) return

    const schema =
      child.type === SIDE_TREE_NODE_TYPE.LINK ? S.createDocTreeLink : S.createDocTreePage

    persistLocalNode(
      childId,
      title,
      schema,
      (slug) => ({
        input: {
          groupId: groupId,
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

    if (isLocalId(groupId)) {
      persistLocalGroup(groupId, title)
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
    if (isLocalId(groupId)) {
      // Keep the inline editor open so a child title cannot appear saved before its parent group exists.
      toast(t('dsb.cms.docs.side_tree.error.confirm_group_first'), 'error')
      return
    }

    const currentChild = findChild(readGroups(), childId)

    if (
      isLocalId(childId) &&
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

    if (isLocalId(childId)) {
      persistLocalChild(groupId, childId, title)
      return
    }

    updateRemoteTitle(childId, title, 'rename child')
  }

  function renameLink(groupId: string, childId: string, input: TSideTreeLinkInput): void {
    if (isLocalId(groupId)) {
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

    if (isLocalId(childId)) {
      persistLocalChild(groupId, childId, title)
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
    if (editingTarget?.type === SIDE_TREE_NODE_TYPE.PIN) {
      if (isLocalId(editingTarget.pinId)) {
        updatePins((currentPins) => currentPins.filter((pin) => pin.id !== editingTarget.pinId))
      }
      setEditingTarget(null)
      return
    }

    if (editingTarget) {
      const currentGroups = readGroups()
      const nextGroups = removeLocalTarget(currentGroups, editingTarget)

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

    if (isLocalId(childId)) return

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
      'childId' in editingTarget &&
      editingTarget.groupId === groupId &&
      editingTarget.childId === childId
    ) {
      setEditingTarget(null)
    }

    if (isLocalId(childId)) {
      requestLocalDelete(childId)
      return
    }

    persistDelete(childId)
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

    if (isLocalId(childId)) return

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
      mutate<TMoveDocToDraftData>(S.moveDocToDraft, { community, id: childId })
        .then((data) => {
          const payload = data?.moveDocToDraft
          const current = findChild(readGroups(), childId)
          const publishState = {
            ...(current?.publishState ?? {}),
            ...(payload?.publishState ?? {}),
            status: ARTICLE_STAGE.DRAFT,
            published: true,
            publishedBefore: true,
            hasDraft: true,
          } satisfies TDocTreeNodePublishState

          patchChild(childId, { publishState })
          reloadDocPublishChecklist()
          send(DSB_DOC_EVENT.DRAFT_PATCH, {
            docId:
              payload?.docId ?? (current?.type === SIDE_TREE_NODE_TYPE.PAGE ? current.docId : null),
            stage: payload?.stage ?? ARTICLE_STAGE.DRAFT,
          })
          toast(t('dsb.cms.docs.side_tree.publish.draft_moved'))
        })
        .catch((err) => {
          toast(formatMutationError(err), 'error')
        })
      return
    }

    if (
      action === SIDE_TREE_NODE_MENU_ACTION.PIN_TO_COVER ||
      action === SIDE_TREE_NODE_MENU_ACTION.UNPIN_FROM_COVER
    ) {
      const pinning = action === SIDE_TREE_NODE_MENU_ACTION.PIN_TO_COVER
      mutate(pinning ? S.pinDocToCover : S.unpinDocFromCover, {
        community,
        nodeId: childId,
      })
        .then(() => {
          const current = findChild(readGroups(), childId)
          patchChild(childId, {
            publishState: {
              ...(current?.publishState ?? {}),
              pinnedToCover: pinning,
            } as TDocTreeNodePublishState,
          })
          toast(
            t(
              pinning
                ? 'dsb.cms.docs.side_tree.cover.pinned'
                : 'dsb.cms.docs.side_tree.cover.unpinned',
            ),
          )
        })
        .catch((err) => toast(formatMutationError(err), 'error'))
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

  function activateTab(id: string): void {
    const tab = tabs.find((item) => item.id === id)
    if (!tab) return

    setActiveTabId(id)
    pinsRef.current = tab.pins
    setPins(tab.pins)
    groupsRef.current = tab.groups
    setGroups(tab.groups)
    selectPage(findFirstPage(tab.groups))
  }

  function renameTab(tabId: string, title: string): void {
    const nextTitle = title.trim()
    const currentTab = tabs.find((tab) => tab.id === tabId)
    if (!nextTitle || !currentTab || currentTab.title === nextTitle) return

    setTabs((current) =>
      current.map((tab) => (tab.id === tabId ? { ...tab, title: nextTitle } : tab)),
    )

    persistTitleMutation(
      nextTitle,
      S.updateDocTreeNode,
      (slug) => ({ id: tabId, patch: { title: nextTitle, slug } }),
      (data) => data?.updateDocTreeNode,
      (node) => {
        setTabs((current) =>
          current.map((tab) =>
            tab.id === tabId
              ? {
                  ...tab,
                  title: node.title || nextTitle,
                  slug: node.slug || undefined,
                }
              : tab,
          ),
        )
      },
      'rename tab',
    )
  }

  function deleteTab(tabId: string): void {
    if (tabs.length <= 1) return

    const removedIndex = tabs.findIndex((tab) => tab.id === tabId)
    if (removedIndex === -1) return

    const nextTabs = tabs.filter((tab) => tab.id !== tabId)
    setTabs(nextTabs)

    if (activeTabId === tabId) {
      const nextActiveTab = nextTabs[Math.min(removedIndex, nextTabs.length - 1)] || null
      setActiveTabId(nextActiveTab?.id ?? null)
      pinsRef.current = nextActiveTab?.pins ?? []
      setPins(nextActiveTab?.pins ?? [])
      groupsRef.current = nextActiveTab?.groups ?? []
      setGroups(nextActiveTab?.groups ?? [])
      setEditingTarget(null)
      selectPage(findFirstPage(nextActiveTab?.groups ?? []))
    }

    persistDelete(tabId)
  }

  function reorderTabs(nextTabs: readonly TSideTreeTab[], movedTabId: string): void {
    const currentIndex = tabs.findIndex((tab) => tab.id === movedTabId)
    const targetIndex = nextTabs.findIndex((tab) => tab.id === movedTabId)
    if (currentIndex === -1 || targetIndex === -1 || currentIndex === targetIndex) return

    setTabs([...nextTabs])
    persist(S.moveDocTreeNode, { id: movedTabId, targetIndex }, (data) => data?.moveDocTreeNode)
  }

  function addTab(): void {
    const title = t(UNTITLED_TITLE_I18N_KEY)

    slugify(title)
      .then((slug) =>
        persist(
          S.createDocTreeTab,
          { input: { title, slug, index: tabs.length } },
          (data) => data?.createDocTreeTab,
        ),
      )
      .then((payload) => {
        if (!payload?.node || payload.conflict) return
        const affectedNodes = payload.affectedNodes || []
        const createdTabs = affectedNodes
          .filter((node) => String(node.type).toLowerCase() === 'tab')
          .map((node) => mapTab({ ...node, groups: [], pins: [] }))
        const tab = mapTab({
          ...payload.node,
          groups: affectedNodes.filter((node) => String(node.type).toLowerCase() === 'group'),
          pins: [],
        })
        setTabs((current) => [
          ...current,
          ...createdTabs.filter((created) => !current.some((item) => item.id === created.id)),
          tab,
        ])
        setActiveTabId(tab.id)
        pinsRef.current = tab.pins
        setPins(tab.pins)
        groupsRef.current = tab.groups
        setGroups(tab.groups)
        selectPage(null)
      })
      .catch((err) => {
        console.error('## doc tree create tab error: ', err)
        reload()
      })
  }

  return {
    tabs,
    activeTabId,
    pins,
    groups,
    treeState,
    stagedEvents,
    trashItems,
    trashLoading,
    activeId,
    editingTarget,
    coverWarning,
    activate,
    activateTab,
    addPin,
    addTab,
    deleteTab,
    renameTab,
    reorderTabs,
    addGroup,
    addChild,
    clearCoverWarning: () => setCoverWarning(null),
    deleteGroup,
    toggleGroup,
    toggleCoverGroup,
    renameGroup,
    renameChild,
    renameLink,
    savePin,
    deletePin,
    cancelEdit,
    edit: setEditingTarget,
    handleChildAction,
    updateChildStyle,
    updatePinStyle,
    patchChild,
    reload,
    reloadTrash,
    reorderGroups,
  }
}
