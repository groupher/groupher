import { useCallback, useEffect, useMemo, useState } from 'react'

import useQuery from '~/hooks/useQuery'
import useCommunity from '~/stores/community/hooks'
import S from '~/unit/DashboardThread/schema'

import useDocsEditor from '../../Editor/store/hooks'
import { DOC_PUBLISH_SCOPE_RELOAD_EVENT } from '../constant'
import { getScopeItems } from './helper'
import type { TPublishScope, TPublishSelectedInput } from './spec'

export default function usePublishScope() {
  const { slug: community } = useCommunity()
  const { setPublishRuntime } = useDocsEditor()
  const { data: publishScopeData, reload: reloadPublishScope } = useQuery<{
    docPublishScope?: TPublishScope | null
  }>(S.docPublishScope, { community })
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

    setSelectedDocIds(
      publishScope.docChanges
        .filter((item) => item.selectable && item.selectedByDefault)
        .map((item) => item.id),
    )
    setSelectedTreeIds(
      publishScope.treeChanges
        .filter((item) => item.selectable && item.selectedByDefault)
        .map((item) => item.id),
    )
  }, [publishScope])

  useEffect(() => {
    const reload = (): void => {
      setPublishRuntime?.({ scopeLoaded: false })
      reloadPublishScope()
    }

    window.addEventListener(DOC_PUBLISH_SCOPE_RELOAD_EVENT, reload)
    return () => window.removeEventListener(DOC_PUBLISH_SCOPE_RELOAD_EVENT, reload)
  }, [reloadPublishScope, setPublishRuntime])

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
