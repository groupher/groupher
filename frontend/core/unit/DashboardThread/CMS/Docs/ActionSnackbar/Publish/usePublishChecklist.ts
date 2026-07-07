import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { DSB_DOC_EVENT } from '~/const/dsb/docs'
import useEvent from '~/hooks/useEvent'
import useQuery from '~/hooks/useQuery'
import useCommunity from '~/stores/community/hooks'
import S from '~/unit/DashboardThread/schema'

import useDocsEditor from '../../Editor/store/hooks'
import {
  formatPublishCountLabel,
  getPublishPlan,
  getRestoreTreeChangeIds,
  getChecklistItemIds,
  getChecklistItems,
  getSelectedPublishCount,
  reconcileSelectedIds,
} from './helper'
import type { TPublishChecklist, TPublishSelectedInput } from './spec'

export default function usePublishChecklist() {
  const { slug: community } = useCommunity()
  const { setPublishRuntime } = useDocsEditor()
  const { data: publishChecklistData, reload: reloadPublishChecklist } = useQuery<{
    docPublishChecklist?: TPublishChecklist | null
  }>(S.docPublishChecklist, { community })
  const seenDocIdsRef = useRef<Set<string>>(new Set())
  const seenTreeIdsRef = useRef<Set<string>>(new Set())
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
  const [selectedTreeIds, setSelectedTreeIds] = useState<string[]>([])
  const publishChecklist = publishChecklistData?.docPublishChecklist ?? null
  const checklistItems = useMemo(() => getChecklistItems(publishChecklist), [publishChecklist])
  const totalChanges = publishChecklist?.totalCount ?? 0
  const publishChecklistLoaded = publishChecklist !== null
  const hasSelectableChanges = checklistItems.some((item) => item.selectable)
  const selectedDocChangeIds = useMemo(
    () =>
      publishChecklist?.docChanges
        .filter((item) => item.selectable && selectedDocIds.includes(item.id))
        .map((item) => item.id) ?? [],
    [publishChecklist, selectedDocIds],
  )
  const selectedTreeChangeIds = useMemo(
    () =>
      publishChecklist?.treeChanges
        .filter((item) => item.selectable && selectedTreeIds.includes(item.id))
        .map((item) => item.id) ?? [],
    [publishChecklist, selectedTreeIds],
  )
  const restoreTreeChangeIds = useMemo(
    () => getRestoreTreeChangeIds(publishChecklist, selectedTreeIds),
    [publishChecklist, selectedTreeIds],
  )
  const publishPlan = useMemo(
    () => getPublishPlan(publishChecklist, selectedDocIds, selectedTreeIds),
    [publishChecklist, selectedDocIds, selectedTreeIds],
  )
  const selectedPublishCount = useMemo(
    () => getSelectedPublishCount(publishChecklist, selectedDocIds, selectedTreeIds),
    [publishChecklist, selectedDocIds, selectedTreeIds],
  )
  const publishCountLabel = useMemo(
    () => formatPublishCountLabel(selectedPublishCount + restoreTreeChangeIds.length, totalChanges),
    [restoreTreeChangeIds.length, selectedPublishCount, totalChanges],
  )
  const hasSelectedChanges = selectedPublishCount > 0 || restoreTreeChangeIds.length > 0

  useEffect(() => {
    setPublishRuntime?.({
      checklistLoaded: publishChecklistLoaded,
      publishCount: totalChanges,
      hasSelectableChecklistItems: hasSelectableChanges,
    })
  }, [
    hasSelectableChanges,
    publishChecklist,
    publishChecklistLoaded,
    setPublishRuntime,
    totalChanges,
  ])

  useEffect(() => {
    if (!publishChecklist) return

    const seenDocIds = seenDocIdsRef.current
    const seenTreeIds = seenTreeIdsRef.current

    setSelectedDocIds((currentIds) =>
      reconcileSelectedIds(publishChecklist.docChanges, currentIds, seenDocIds),
    )
    setSelectedTreeIds((currentIds) =>
      reconcileSelectedIds(publishChecklist.treeChanges, currentIds, seenTreeIds),
    )

    seenDocIdsRef.current = getChecklistItemIds(publishChecklist.docChanges)
    seenTreeIdsRef.current = getChecklistItemIds(publishChecklist.treeChanges)
  }, [publishChecklist])

  useEvent(
    DSB_DOC_EVENT.PUBLISH_CHECKLIST_RELOAD,
    (): void => {
      setPublishRuntime?.({ checklistLoaded: false })
      reloadPublishChecklist()
    },
    [reloadPublishChecklist, setPublishRuntime],
  )

  const selectedInput = useCallback((): TPublishSelectedInput | undefined => {
    if (!publishChecklist) return undefined

    return {
      docChangeIds: selectedDocChangeIds,
      treeChangeIds: selectedTreeChangeIds,
      restoreTreeChangeIds,
    }
  }, [publishChecklist, restoreTreeChangeIds, selectedDocChangeIds, selectedTreeChangeIds])

  return {
    hasSelectedChanges,
    publishPlan,
    publishChecklist,
    publishCountLabel,
    reloadPublishChecklist,
    selectedDocIds,
    selectedInput,
    selectedTreeIds,
    setSelectedDocIds,
    setSelectedTreeIds,
  }
}

export type TPublishChecklistController = ReturnType<typeof usePublishChecklist>
