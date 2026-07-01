import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'

import { DSB_DOC_EVENT } from '~/const/dsb/docs'
import useEvent from '~/hooks/useEvent'
import useQuery from '~/hooks/useQuery'
import useCommunity from '~/stores/community/hooks'
import S from '~/unit/DashboardThread/schema'

import useDocsEditor from '../../Editor/store/hooks'
import { getScopeItems } from './helper'
import type { TPublishScope, TPublishSelectedInput } from './spec'

const reconcileSelectedIds = (
  items: TPublishScope['docChanges'],
  currentIds: string[],
  seenIdsRef: MutableRefObject<Set<string>>,
): string[] => {
  const selectableIds = new Set(items.filter((item) => item.selectable).map((item) => item.id))
  const nextSeenIds = new Set(items.map((item) => item.id))
  const selectedIds = new Set(currentIds.filter((id) => selectableIds.has(id)))

  for (const item of items) {
    if (item.selectable && item.selectedByDefault && !seenIdsRef.current.has(item.id)) {
      selectedIds.add(item.id)
    }
  }

  seenIdsRef.current = nextSeenIds

  return Array.from(selectedIds)
}

export default function usePublishScope() {
  const { slug: community } = useCommunity()
  const { setPublishRuntime } = useDocsEditor()
  const { data: publishScopeData, reload: reloadPublishScope } = useQuery<{
    docPublishScope?: TPublishScope | null
  }>(S.docPublishScope, { community })
  const seenDocIdsRef = useRef<Set<string>>(new Set())
  const seenTreeIdsRef = useRef<Set<string>>(new Set())
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
  const [selectedTreeIds, setSelectedTreeIds] = useState<string[]>([])
  const publishScope = publishScopeData?.docPublishScope ?? null
  const scopeItems = useMemo(() => getScopeItems(publishScope), [publishScope])
  const totalChanges = publishScope?.totalCount ?? 0
  const publishScopeLoaded = publishScope !== null
  const hasSelectableChanges = scopeItems.some((item) => item.selectable)
  const selectedDocChangeIds = useMemo(
    () =>
      publishScope?.docChanges
        .filter((item) => item.selectable && selectedDocIds.includes(item.id))
        .map((item) => item.id) ?? [],
    [publishScope, selectedDocIds],
  )
  const selectedTreeChangeIds = useMemo(
    () =>
      publishScope?.treeChanges
        .filter((item) => item.selectable && selectedTreeIds.includes(item.id))
        .map((item) => item.id) ?? [],
    [publishScope, selectedTreeIds],
  )
  const hasSelectedChanges = selectedDocChangeIds.length + selectedTreeChangeIds.length > 0

  useEffect(() => {
    setPublishRuntime?.({
      scopeLoaded: publishScopeLoaded,
      publishCount: totalChanges,
      hasSelectableScopeItems: hasSelectableChanges,
    })
  }, [hasSelectableChanges, publishScope, publishScopeLoaded, setPublishRuntime, totalChanges])

  useEffect(() => {
    if (!publishScope) return

    setSelectedDocIds((currentIds) =>
      reconcileSelectedIds(publishScope.docChanges, currentIds, seenDocIdsRef),
    )
    setSelectedTreeIds((currentIds) =>
      reconcileSelectedIds(publishScope.treeChanges, currentIds, seenTreeIdsRef),
    )
  }, [publishScope])

  useEvent(
    DSB_DOC_EVENT.PUBLISH_SCOPE_RELOAD,
    (): void => {
      setPublishRuntime?.({ scopeLoaded: false })
      reloadPublishScope()
    },
    [reloadPublishScope, setPublishRuntime],
  )

  const selectedInput = useCallback((): TPublishSelectedInput | undefined => {
    if (!publishScope) return undefined

    return {
      docChangeIds: selectedDocChangeIds,
      treeChangeIds: selectedTreeChangeIds,
    }
  }, [publishScope, selectedDocChangeIds, selectedTreeChangeIds])

  return {
    hasSelectedChanges,
    publishScope,
    reloadPublishScope,
    selectedDocIds,
    selectedInput,
    selectedTreeIds,
    setSelectedDocIds,
    setSelectedTreeIds,
  }
}
