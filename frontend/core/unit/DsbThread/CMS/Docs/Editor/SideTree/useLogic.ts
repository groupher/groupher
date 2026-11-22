import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ARTICLE_STAGE } from '~/const/article'
import { browserGraphQLRequest } from '~/graphql/client'
import usePagiPosition from '~/hooks/usePagiPosition'
import useTrans from '~/hooks/useTrans'
import { graphqlQueryOptions } from '~/query'
import { executeCommand } from '~/query/mutation/optimistic/execute'
import useCommunity from '~/stores/community/hooks'
import { toast } from '~/ui/Toaster'
import S from '~/unit/DsbThread/schema/docs'

import { reloadDocsPublishQueue } from '../helper'
import useDocsEditor from '../store/hooks'
import {
  DEFAULT_LINK_MARKER,
  DOC_TREE_NODE_TYPE_WIRE,
  SIDE_TREE_NODE_MENU_ACTION,
  SIDE_TREE_NODE_TYPE,
  UNTITLED_TITLE_I18N_KEY,
} from './constant'
import {
  createSideTreeChild,
  createSideTreeGroup,
  createSideTreePin,
  duplicateChildInGroup,
  findChild,
  findChildEditingTarget,
  findChildIndex,
  findFirstPage,
  findGroup,
  findGroupIndex,
  findNodePosition,
  formatMutationError,
  getDocIdFromPage,
  getDefaultLinkTitle,
  isActiveRemovedByTarget,
  isLocalId,
  isLinkHref,
  insertLocalNodeInGroup,
  mapGroup,
  mapNode,
  mapPin,
  moveChildToLeafEnd,
  moveGroupToGroupLaneEnd,
  patchChildInGroups,
  patchGroupInGroups,
  removeChildFromGroup,
  removeLocalTarget,
  removeGroupFromGroups,
  replaceChildId,
  replaceGroupId,
  resolveActiveIdFromUrl,
  toggleGroupExpandedInGroups,
  updateChildMarkerInGroup,
  updateChildTitleInGroup,
  workspaceTabs,
} from './helper'
import type {
  TDocTreeInitialData,
  TDocTreeEvent,
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
  TWorkspaceNode,
} from './spec'
import useDocEditorUrl from './useDocEditorUrl'
import useSideTreePersistence from './usePersistence'

type TLocalCreateState = {
  deleteRequested: boolean
}

const hasLocalNode = (groups: readonly TSideTreeGroup[], pins: readonly TSideTreePin[]): boolean =>
  pins.some((pin) => isLocalId(pin.id)) ||
  groups.some(
    (group) =>
      isLocalId(group.id) ||
      group.pages.some((child) => isLocalId(child.id)) ||
      hasLocalNode(
        group.pages.filter(
          (child): child is TSideTreeGroup => child.type === SIDE_TREE_NODE_TYPE.GROUP,
        ),
        [],
      ),
  )

const mapTab = (node: TDocTreeNodeDTO): TSideTreeTab => ({
  id: node.id,
  title: node.title || '',
  pins: (node.pins || []).map(mapPin),
  groups: (node.groups || []).map(mapGroup),
})

const findTabByDocId = (tabs: readonly TSideTreeTab[], docId: string | null): TSideTreeTab | null =>
  tabs.find((tab) => resolveActiveIdFromUrl(tab.groups, docId) !== null) ?? null

/** Exposes logic state and actions through the shared React hook boundary. */
export default function useLogic(initialData?: TDocTreeInitialData): TSideTreeController {
  const { t } = useTrans()
  const { saveStatus } = useDocsEditor()
  const saveStatusRef = useRef(saveStatus)
  saveStatusRef.current = saveStatus
  const { currentDocId, syncDocIdToUrl } = useDocEditorUrl()
  const { slug: community } = useCommunity()
  const { data, refetch: reload } = useQuery(
    graphqlQueryOptions<{
      docsWorkspaceTree?: {
        treeRevision: number
        queueRevision: number
        nodes: TWorkspaceNode[]
      }
    }>(S.docsWorkspaceTree, { community }),
  )
  const { data: queueData } = useQuery(
    graphqlQueryOptions<{
      docsPublishQueue?: { revision: number; articles: { articleId: string }[] } | null
    }>(S.docsPublishQueue, { community }),
  )
  const trashPosition = usePagiPosition(`${community}:doc-trash`)
  const {
    data: trashData,
    error: trashError,
    isFetching: trashLoading,
    refetch: reloadTrash,
  } = useQuery(
    graphqlQueryOptions<TDocTreeTrashData>(S.docTreeTrashItems, {
      community,
      pagi: trashPosition.input,
    }),
  )
  const trashItems = trashData?.docTreeTrashItems?.entries ?? []
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
  const queueRevisionRef = useRef<number | null>(null)
  const deletingRef = useRef(false)
  const creatingDefaultTabRef = useRef(false)
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
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null)
  const deleteConfirmationResolver = useRef<((confirmed: boolean) => void) | null>(null)
  const finishDeleteConfirmation = useCallback((confirmed: boolean) => {
    deleteConfirmationResolver.current?.(confirmed)
    deleteConfirmationResolver.current = null
    setDeleteConfirmation(null)
  }, [])
  useEffect(
    () => () => {
      deleteConfirmationResolver.current?.(false)
      deleteConfirmationResolver.current = null
    },
    [],
  )
  const { persistCoverAction, persistWorkspaceUpdate, persistWorkspaceMove } =
    useSideTreePersistence({
      revisionRef,
      setTreeState,
      setCoverWarning,
      reload,
    })

  async function persistDelete(nodeId: string): Promise<void> {
    if (deletingRef.current || revisionRef.current === null || queueRevisionRef.current === null)
      return
    if (['dirty', 'saving', 'error'].includes(saveStatusRef.current)) {
      toast(t('dsb.doc.queue.delete_wait_save'), 'error')
      return
    }
    deletingRef.current = true
    const treeRevision = revisionRef.current
    const queueRevision = queueRevisionRef.current
    try {
      const data = await browserGraphQLRequest<{
        docsWorkspaceDeletePreview?: {
          publicCount: number
          draftCount: number
          requiresConfirmation: boolean
          confirmation?: { formatVersion: number; hash: string } | null
        } | null
      }>(S.docsWorkspaceDeletePreview, { community, treeRevision, queueRevision, nodeId })
      const preview = data?.docsWorkspaceDeletePreview
      if (!preview || (preview.requiresConfirmation && !preview.confirmation))
        throw new Error('Unable to check deletion')
      const message = [
        t('dsb.doc.queue.delete_confirm'),
        `${t('dsb.doc.queue.delete_public_count')}: ${preview.publicCount}`,
        `${t('dsb.doc.queue.delete_draft_count')}: ${preview.draftCount}`,
        preview.requiresConfirmation ? t('dsb.doc.queue.discard_warning') : '',
      ]
        .filter(Boolean)
        .join('\n')
      const confirmed = await new Promise<boolean>((resolve) => {
        deleteConfirmationResolver.current = resolve
        setDeleteConfirmation(message)
      })
      if (!confirmed) return
      if (['dirty', 'saving', 'error'].includes(saveStatusRef.current)) {
        toast(t('dsb.doc.queue.delete_wait_save'), 'error')
        return
      }
      const result = await executeCommand({
        request: (variables) =>
          browserGraphQLRequest<{
            deleteDocsWorkspaceNode?: { treeRevision: number; queueRevision: number } | null
          }>(S.deleteDocsWorkspaceNode, variables),
        variables: {
          community,
          treeRevision,
          queueRevision,
          nodeId,
          confirmation: preview.confirmation ?? undefined,
        },
      })
      if (!result?.deleteDocsWorkspaceNode) throw new Error('Unable to delete item')
      revisionRef.current = result.deleteDocsWorkspaceNode.treeRevision
      queueRevisionRef.current = result.deleteDocsWorkspaceNode.queueRevision
      reloadDocsPublishQueue()
      void reloadTrash()
      if (['dirty', 'saving', 'error'].includes(saveStatusRef.current)) {
        toast(t('dsb.doc.queue.delete_unsaved_preserved'), 'error')
        return
      }
      const refreshed = await reload()
      const freshNodes = refreshed?.data?.docsWorkspaceTree?.nodes
      if (freshNodes && currentDocIdRef.current) {
        const freshTabs = workspaceTabs(freshNodes, new Set())
        if (!findTabByDocId(freshTabs, currentDocIdRef.current)) {
          syncDocIdToUrl(getDocIdFromPage(findFirstPage(freshTabs[0]?.groups ?? [])))
        }
      }
    } catch (err) {
      toast(formatMutationError(err), 'error')
      reloadDocsPublishQueue()
      void reload()
    } finally {
      deletingRef.current = false
    }
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
    if (!data?.docsWorkspaceTree) return
    if (revisionRef.current !== null && data.docsWorkspaceTree.treeRevision < revisionRef.current)
      return

    revisionRef.current = data.docsWorkspaceTree.treeRevision
    queueRevisionRef.current = Math.max(
      queueRevisionRef.current ?? 0,
      data.docsWorkspaceTree.queueRevision,
    )
    setTreeState(null)
    setStagedEvents([])

    if (hasLocalNode(groupsRef.current, pinsRef.current)) return

    const queuedIds = new Set(
      queueData?.docsPublishQueue?.articles.map((article) => article.articleId) ?? [],
    )
    const nextTabs = workspaceTabs(data.docsWorkspaceTree.nodes, queuedIds)
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
  }, [commitGroups, data, queueData, syncActiveIdFromUrl])

  useEffect(() => {
    if (queueData?.docsPublishQueue) {
      queueRevisionRef.current = Math.max(
        queueRevisionRef.current ?? 0,
        queueData.docsPublishQueue.revision,
      )
    }
  }, [queueData])

  useEffect(() => {
    syncActiveIdFromUrl(groupsRef.current)
  }, [currentDocId, syncActiveIdFromUrl])

  function persistLocalNode(
    localId: string,
    title: string,
    variables: () => Record<string, unknown>,
    onCreated: (node: TDocTreeNodeDTO) => void,
    errorLabel: string,
  ): void {
    if (localCreateStateRef.current.has(localId)) return

    const createState: TLocalCreateState = { deleteRequested: false }
    localCreateStateRef.current.set(localId, createState)

    const attrs = variables()
    const input = attrs.input as TDocTreeNodeDTO
    if (revisionRef.current === null) {
      localCreateStateRef.current.delete(localId)
      void reload()
      return
    }

    executeCommand({
      request: (args) =>
        browserGraphQLRequest<{
          createDocsWorkspaceNode?: {
            nodeId: string
            articleId?: string | null
            workingCopyId?: string | null
            treeRevision: number
          } | null
        }>(S.createDocsWorkspaceNode, args),
      variables: { community, treeRevision: revisionRef.current, ...attrs },
    })
      .then(async (data) => {
        const created = data?.createDocsWorkspaceNode
        if (!created) throw new Error(errorLabel)
        revisionRef.current = created.treeRevision
        const node: TDocTreeNodeDTO = {
          ...input,
          id: created.nodeId,
          parentNodeId: (attrs.parentNodeId as string | undefined) ?? null,
          title,
          docId: created.articleId,
          workingCopyId: created.workingCopyId,
          workingCopyRevision: created.workingCopyId ? 1 : null,
          publishState: created.articleId
            ? { published: false, hasDraft: true, status: ARTICLE_STAGE.DRAFT }
            : undefined,
        }
        if (createState.deleteRequested) {
          const latest = await browserGraphQLRequest<{
            docsWorkspaceTree?: { treeRevision: number; queueRevision: number } | null
          }>(S.docsWorkspaceTree, { community })
          if (!latest?.docsWorkspaceTree) throw new Error('Unable to load directory state')
          revisionRef.current = latest.docsWorkspaceTree.treeRevision
          queueRevisionRef.current = latest.docsWorkspaceTree.queueRevision
          await persistDelete(created.nodeId)
          void reload()
          return
        }

        onCreated(node)
      })
      .catch((err) => {
        toast(formatMutationError(err), 'error')
        void reload()
      })
      .finally(() => localCreateStateRef.current.delete(localId))
  }

  function requestLocalDelete(localId: string): void {
    const createState = localCreateStateRef.current.get(localId)
    if (createState) createState.deleteRequested = true
  }

  const reorderGroups = useCallback(
    (nextGroups: readonly TSideTreeGroup[], activeNodeId: string): void => {
      const localGroups = [...nextGroups]

      // DnD commits should use the same ref/state write path as normal tree mutations.
      commitGroups(localGroups)

      const moved = findNodePosition(localGroups, activeNodeId)
      if (!moved) return
      if (isLocalId(activeNodeId) || (moved.parentNodeId && isLocalId(moved.parentNodeId))) return

      void persistWorkspaceMove(activeNodeId, moved.parentNodeId ?? null, moved.index)
    },
    [commitGroups, persistWorkspaceMove],
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
    const addToTab = (tabId: string): void => {
      const group = createSideTreeGroup(t(UNTITLED_TITLE_I18N_KEY))
      group.parentNodeId = tabId
      const nextGroups = [group, ...groupsRef.current]
      groupsRef.current = nextGroups
      setGroups(nextGroups)
      setTabs((currentTabs) =>
        currentTabs.map((tab) => (tab.id === tabId ? { ...tab, groups: nextGroups } : tab)),
      )
      setEditingTarget({ type: SIDE_TREE_NODE_TYPE.GROUP, groupId: group.id })
    }

    if (activeTabId) {
      addToTab(activeTabId)
      return
    }

    if (creatingDefaultTabRef.current) return
    creatingDefaultTabRef.current = true
    createTab(
      (tab) => {
        addToTab(tab.id)
        creatingDefaultTabRef.current = false
      },
      () => {
        creatingDefaultTabRef.current = false
      },
    )
  }

  function addNestedGroup(parentGroupId: string): void {
    const group = createSideTreeGroup(t(UNTITLED_TITLE_I18N_KEY))
    group.parentNodeId = parentGroupId
    updateGroups((currentGroups) => insertLocalNodeInGroup(currentGroups, parentGroupId, group))
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

    updateGroups((currentGroups) => insertLocalNodeInGroup(currentGroups, groupId, child))
    setEditingTarget({ type: child.type, groupId, childId: child.id })
  }

  /**
   * Delete a group and all of its pages.
   *
   * @example
   * deleteGroup('group-getting-started')
   */
  function deleteGroup(groupId: string): void {
    if (!isLocalId(groupId)) {
      void persistDelete(groupId)
      return
    }
    const currentGroups = readGroups()
    const group = findGroup(currentGroups, groupId)
    const activeInGroup = group?.pages.some((child) => child.id === activeId) ?? false
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
    persistCoverAction(inCover ? S.removeDocCoverCard : S.addDocCoverCard, {
      groupNodeId: groupId,
    }).then((ok) => {
      if (!ok) return
      toast(
        inCover
          ? t('dsb.cms.docs.side_tree.cover.removed')
          : t('dsb.cms.docs.side_tree.cover.added'),
      )
    })
  }

  function persistLocalGroup(groupId: string, title: string): void {
    const group = findGroup(readGroups(), groupId)
    const index = findGroupIndex(readGroups(), groupId)
    if (!group || index === -1) return

    persistLocalNode(
      groupId,
      title,
      () => ({
        parentNodeId: group.parentNodeId,
        input: {
          type: DOC_TREE_NODE_TYPE_WIRE.GROUP,
          title,
          index,
        },
      }),
      (node) => {
        updateGroups((currentGroups) => replaceGroupId(currentGroups, groupId, mapGroup(node)))
      },
      'create group',
    )
  }

  function updateRemoteTitle(nodeId: string, title: string): void {
    void persistWorkspaceUpdate(nodeId, { title })
  }

  function updateRemoteLink(nodeId: string, input: TSideTreeLinkInput): void {
    void persistWorkspaceUpdate(nodeId, { href: input.href, title: input.title })
  }

  function persistLocalPin(pinId: string, input: TSideTreeLinkInput): void {
    const pin = readPins().find((item) => item.id === pinId)
    const index = readPins().findIndex((item) => item.id === pinId)
    if (!pin || index === -1 || !activeTabId) return

    persistLocalNode(
      pinId,
      input.title,
      () => ({
        parentNodeId: activeTabId,
        input: {
          type: DOC_TREE_NODE_TYPE_WIRE.PIN,
          title: input.title,
          href: input.href,
          index,
          marker: pin.marker,
        },
      }),
      (node) => {
        updatePins((currentPins) =>
          currentPins.map((item) => (item.id === pinId ? mapPin(node) : item)),
        )
      },
      'create pin',
    )
  }

  function updateRemotePin(pinId: string, input: TSideTreeLinkInput): void {
    void persistWorkspaceUpdate(pinId, { href: input.href, title: input.title })
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
    if (!isLocalId(pinId)) {
      void persistDelete(pinId)
      return
    }
    updatePins((currentPins) => currentPins.filter((pin) => pin.id !== pinId))
    if (editingTarget?.type === SIDE_TREE_NODE_TYPE.PIN && editingTarget.pinId === pinId) {
      setEditingTarget(null)
    }

    if (isLocalId(pinId)) {
      requestLocalDelete(pinId)
      return
    }
  }

  function updatePinStyle(pinId: string, marker: TSideTreePin['marker']): void {
    updatePins((currentPins) =>
      currentPins.map((pin) => (pin.id === pinId ? { ...pin, marker } : pin)),
    )

    if (isLocalId(pinId)) return

    void persistWorkspaceUpdate(pinId, { marker })
  }

  function persistLocalChild(groupId: string, childId: string, title: string): void {
    const currentGroups = readGroups()
    const group = findGroup(currentGroups, groupId)
    const child = group?.pages.find((item) => item.id === childId)
    const index = findChildIndex(currentGroups, groupId, childId)
    if (!child || index === -1) return

    persistLocalNode(
      childId,
      title,
      () => ({
        parentNodeId: groupId,
        input: {
          type:
            child.type === SIDE_TREE_NODE_TYPE.PAGE
              ? DOC_TREE_NODE_TYPE_WIRE.PAGE
              : DOC_TREE_NODE_TYPE_WIRE.LINK,
          title,
          index,
          href: child.type === SIDE_TREE_NODE_TYPE.LINK ? child.href : undefined,
          marker: child.marker,
        },
      }),
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
    setEditingTarget(null)

    if (isLocalId(groupId)) {
      updateGroups((currentGroups) =>
        moveGroupToGroupLaneEnd(patchGroupInGroups(currentGroups, groupId, { title }), groupId),
      )
      persistLocalGroup(groupId, title)
      return
    }

    updateGroup(groupId, { title })
    updateRemoteTitle(groupId, title)
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
      updateGroups((currentGroups) => moveChildToLeafEnd(currentGroups, groupId, childId))
      persistLocalChild(groupId, childId, title)
      return
    }

    updateRemoteTitle(childId, title)
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
      updateGroups((currentGroups) => moveChildToLeafEnd(currentGroups, groupId, childId))
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

    void persistWorkspaceUpdate(childId, { marker })
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
    if (!isLocalId(childId)) {
      void persistDelete(childId)
      return
    }
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
  }

  function duplicateChild(groupId: string, childId: string): void {
    if (isLocalId(childId)) {
      const { groups: nextGroups, duplicatedId } = duplicateChildInGroup(
        readGroups(),
        groupId,
        childId,
        t(UNTITLED_TITLE_I18N_KEY),
      )
      if (duplicatedId) commitGroups(nextGroups)
      return
    }
    if (revisionRef.current === null) return
    executeCommand({
      request: (variables) => browserGraphQLRequest(S.duplicateDocsWorkspaceNode, variables),
      variables: { community, treeRevision: revisionRef.current, nodeId: childId },
    })
      .then(() => {
        reloadDocsPublishQueue()
        void reload()
      })
      .catch((err) => {
        toast(formatMutationError(err), 'error')
        void reload()
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

    if (
      action === SIDE_TREE_NODE_MENU_ACTION.PIN_TO_COVER ||
      action === SIDE_TREE_NODE_MENU_ACTION.UNPIN_FROM_COVER
    ) {
      const pinning = action === SIDE_TREE_NODE_MENU_ACTION.PIN_TO_COVER
      executeCommand({
        request: (variables) =>
          browserGraphQLRequest(pinning ? S.pinDocToCover : S.unpinDocFromCover, variables),
        variables: { community, nodeId: childId },
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

    void persistWorkspaceUpdate(tabId, { title: nextTitle })
  }

  function deleteTab(tabId: string): void {
    if (!isLocalId(tabId)) {
      void persistDelete(tabId)
      return
    }
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
  }

  function reorderTabs(nextTabs: readonly TSideTreeTab[], movedTabId: string): void {
    const currentIndex = tabs.findIndex((tab) => tab.id === movedTabId)
    const targetIndex = nextTabs.findIndex((tab) => tab.id === movedTabId)
    if (currentIndex === -1 || targetIndex === -1 || currentIndex === targetIndex) return

    setTabs([...nextTabs])
    void persistWorkspaceMove(movedTabId, null, targetIndex)
  }

  function addTab(): void {
    createTab()
  }

  function createTab(onCreated?: (tab: TSideTreeTab) => void, onError?: () => void): void {
    const title = t(UNTITLED_TITLE_I18N_KEY)
    if (revisionRef.current === null) {
      void reload()
      onError?.()
      return
    }

    executeCommand({
      request: (args) =>
        browserGraphQLRequest<{
          createDocsWorkspaceNode?: { nodeId: string; treeRevision: number } | null
        }>(S.createDocsWorkspaceNode, args),
      variables: {
        community,
        treeRevision: revisionRef.current,
        input: { type: DOC_TREE_NODE_TYPE_WIRE.TAB, title, index: tabs.length },
      },
    })
      .then((data) => {
        const created = data?.createDocsWorkspaceNode
        if (!created) throw new Error('create tab')
        revisionRef.current = created.treeRevision
        const tab: TSideTreeTab = { id: created.nodeId, title, groups: [], pins: [] }
        setTabs((current) => [...current, tab])
        setActiveTabId(tab.id)
        pinsRef.current = tab.pins
        setPins(tab.pins)
        groupsRef.current = tab.groups
        setGroups(tab.groups)
        selectPage(null)
        onCreated?.(tab)
      })
      .catch((err) => {
        console.error('## doc tree create tab error: ', err)
        onError?.()
        void reload()
      })
  }

  return {
    tabs,
    activeTabId,
    pins,
    groups,
    treeState,
    workspaceRevision: data?.docsWorkspaceTree?.treeRevision ?? initialData?.revision ?? null,
    queueRevision: data?.docsWorkspaceTree
      ? Math.max(data.docsWorkspaceTree.queueRevision, queueData?.docsPublishQueue?.revision ?? 0)
      : (queueData?.docsPublishQueue?.revision ?? null),
    stagedEvents,
    trashItems,
    trashPageInfo: trashData?.docTreeTrashItems?.pageInfo,
    setTrashPage: trashPosition.setPage,
    trashError: trashError ? String(trashError) : null,
    trashLoading,
    activeId,
    editingTarget,
    coverWarning,
    deleteConfirmation,
    finishDeleteConfirmation,
    activate,
    activateTab,
    addPin,
    addTab,
    deleteTab,
    renameTab,
    reorderTabs,
    addGroup,
    addNestedGroup,
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
