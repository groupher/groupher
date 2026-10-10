'use client'

import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { browserGraphQLRequest } from '~/graphql/client'
import { graphqlQueryOptions } from '~/query'
import { executeCommand } from '~/query/mutation/optimistic/execute'
import useCommunity from '~/stores/community/hooks'
import { toast } from '~/ui/Toaster'
import S from '~/unit/DsbThread/schema/assets'

import {
  ASSETS_HUB_DEBUG_UPLOAD_THREAD,
  ASSETS_HUB_MESSAGE,
  ASSETS_HUB_PAGE_SIZE,
  ASSETS_HUB_REFS_PAGE_SIZE,
  ASSETS_HUB_THREAD_FILTER,
  ASSETS_HUB_UPLOAD_STATUS,
} from './constant'
import { assetPublicReadUrl, extractErrorMessage } from './helper'
import type {
  TAsset,
  TAssetStats,
  TAssetThreadFilter,
  TAssetsHubLogic,
  TDeleteResult,
  TPagedAssetRefs,
  TPagedAssets,
  TReferencesState,
  TTiming,
  TUploadProgress,
} from './spec'
import { uploadCommunityAsset, type TCommunityAssetUploadStage } from './uploadCommunityAsset'

const EMPTY_REFS_STATE: TReferencesState = {
  assetId: null,
  entries: [],
  error: null,
  loading: false,
  totalCount: 0,
}

/** Exposes assets hub state and actions through the shared React hook boundary. */
export default function useAssetsHub(initialData?: TPagedAssets | null): TAssetsHubLogic {
  const { slug: community } = useCommunity()
  const [status, setStatus] = useState<string>(ASSETS_HUB_UPLOAD_STATUS.IDLE)
  const [busy, setBusy] = useState(false)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null)
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [activeThread, setActiveThread] = useState<TAssetThreadFilter>(ASSETS_HUB_THREAD_FILTER.ALL)
  const [searchQuery, setSearchQuery] = useState('')
  const [timings, setTimings] = useState<TTiming[]>([])
  const [uploadProgress, setUploadProgress] = useState<TUploadProgress | null>(null)
  const [references, setReferences] = useState<TReferencesState>(EMPTY_REFS_STATE)
  const refsRequestId = useRef(0)

  const assetFilter = useMemo(() => {
    const filter: { page: number; query?: string; size: number; thread?: TAssetThreadFilter } = {
      page: 1,
      size: ASSETS_HUB_PAGE_SIZE,
    }
    const query = searchQuery.trim()

    if (activeThread !== ASSETS_HUB_THREAD_FILTER.ALL) filter.thread = activeThread
    if (query) filter.query = query

    return filter
  }, [activeThread, searchQuery])

  const {
    data,
    error,
    isFetching: loading,
    refetch: reload,
  } = useQuery(
    graphqlQueryOptions<{ pagedCommunityAssets: TPagedAssets }>(S.pagedCommunityAssets, {
      community,
      filter: assetFilter,
    }),
  )
  const {
    data: statsData,
    error: statsError,
    refetch: reloadStats,
  } = useQuery(
    graphqlQueryOptions<{ communityAssetStats: TAssetStats }>(S.communityAssetStats, {
      community,
      filter: assetFilter,
    }),
  )

  const assets = useMemo(
    () => data?.pagedCommunityAssets?.entries ?? initialData?.entries ?? [],
    [data, initialData],
  )
  const totalCount = data?.pagedCommunityAssets?.totalCount ?? 0
  const assetsErrorMessage = error ? extractErrorMessage(error) : null
  const stats = statsData?.communityAssetStats ?? null
  const statsErrorMessage = statsError ? extractErrorMessage(statsError) : null

  const selectedAsset = useMemo<TAsset | null>(
    () => (selectedAssetId ? (assets.find((asset) => asset.id === selectedAssetId) ?? null) : null),
    [assets, selectedAssetId],
  )
  const selectedAssetUrl = selectedAsset ? assetPublicReadUrl(selectedAsset) : ''

  const loadReferences = useCallback(
    async (assetId: string): Promise<TPagedAssetRefs | null> => {
      if (!community) return null

      const requestId = refsRequestId.current + 1
      refsRequestId.current = requestId
      setReferences({
        assetId,
        entries: [],
        error: null,
        loading: true,
        totalCount: 0,
      })

      try {
        const refData = await browserGraphQLRequest<
          { communityAssetRefs: TPagedAssetRefs },
          { assetId: string; community: string; filter: { page: number; size: number } }
        >(S.communityAssetRefs, {
          assetId,
          community,
          filter: { page: 1, size: ASSETS_HUB_REFS_PAGE_SIZE },
        })
        const refsPage = refData.communityAssetRefs

        if (refsRequestId.current === requestId) {
          setReferences({
            assetId,
            entries: refsPage.entries ?? [],
            error: null,
            loading: false,
            totalCount: refsPage.totalCount ?? 0,
          })
        }

        return refsPage
      } catch (error) {
        const message = extractErrorMessage(error)

        if (refsRequestId.current === requestId) {
          setReferences({
            assetId,
            entries: [],
            error: message,
            loading: false,
            totalCount: 0,
          })
        }

        return null
      }
    },
    [community],
  )

  useEffect(() => {
    if (!selectedAsset?.id) {
      setReferences(EMPTY_REFS_STATE)
      return
    }

    void loadReferences(selectedAsset.id)
  }, [loadReferences, selectedAsset?.id])

  const uploadFile = useCallback(
    async (file: File): Promise<void> => {
      setBusy(true)
      setStatus(ASSETS_HUB_UPLOAD_STATUS.CHECKSUM)
      setTimings([])
      setUploadProgress(null)

      try {
        const upload = await uploadCommunityAsset({
          community,
          file,
          onProgress: setUploadProgress,
          onStage: (stage: TCommunityAssetUploadStage, state, duration) => {
            const label =
              ASSETS_HUB_UPLOAD_STATUS[stage.toUpperCase() as keyof typeof ASSETS_HUB_UPLOAD_STATUS]
            if (state === 'running') {
              setStatus(label)
              setTimings((items) => [...items, { label, state: 'running' }])
              return
            }

            setTimings((items) =>
              items.map((item) =>
                item.label === label ? { ...item, duration, state: 'done' } : item,
              ),
            )
          },
          thread: ASSETS_HUB_DEBUG_UPLOAD_THREAD,
        })

        if (upload.timings.length > 0) {
          setTimings((items) => [
            ...items,
            ...upload.timings.map((item) => ({
              duration: item.duration,
              label: `finalize.${item.label}`,
              state: 'done' as const,
            })),
          ])
        }

        setStatus(ASSETS_HUB_UPLOAD_STATUS.DONE)
        toast(ASSETS_HUB_MESSAGE.UPLOAD_COMPLETED, 'success')
        reload()
        reloadStats()
      } catch (error) {
        setStatus(ASSETS_HUB_UPLOAD_STATUS.FAILED)
        toast(extractErrorMessage(error), 'error')
      } finally {
        setBusy(false)
      }
    },
    [community, reload, reloadStats],
  )

  const openPublicReadPreview = useCallback((asset: TAsset): void => {
    const publicReadUrl = assetPublicReadUrl(asset)

    if (!publicReadUrl) {
      toast(ASSETS_HUB_MESSAGE.MISSING_PUBLIC_REF, 'error')
      return
    }

    window.open(publicReadUrl, '_blank', 'noopener,noreferrer')
  }, [])

  const copyPublicReadUrl = useCallback(async (asset: TAsset): Promise<void> => {
    const publicReadUrl = assetPublicReadUrl(asset)

    if (!publicReadUrl) {
      toast(ASSETS_HUB_MESSAGE.MISSING_PUBLIC_REF, 'error')
      return
    }

    try {
      await navigator.clipboard.writeText(publicReadUrl)
      toast(ASSETS_HUB_MESSAGE.URL_COPIED, 'success')
    } catch (error) {
      toast(extractErrorMessage(error) || ASSETS_HUB_MESSAGE.UNABLE_TO_COPY_URL, 'error')
    }
  }, [])

  const deleteAsset = useCallback(
    async (asset: TAsset): Promise<void> => {
      const refsPage = await loadReferences(asset.id)

      if (refsPage && refsPage.totalCount > 0) {
        setConfirmingDeleteId(null)
        toast(ASSETS_HUB_MESSAGE.REFERENCED_DELETE_BLOCKED, 'error')
        return
      }

      setDeletingAssetId(asset.id)

      try {
        await executeCommand({
          request: (variables) =>
            browserGraphQLRequest<TDeleteResult>(S.deleteCommunityAsset, variables),
          variables: { community, id: asset.id },
        })

        if (selectedAssetId === asset.id) setSelectedAssetId(null)

        setConfirmingDeleteId(null)
        toast(ASSETS_HUB_MESSAGE.ASSET_DELETED, 'success')
        reload()
        reloadStats()
      } catch (error) {
        toast(extractErrorMessage(error), 'error')
      } finally {
        setDeletingAssetId(null)
      }
    },
    [community, loadReferences, reload, reloadStats, selectedAssetId],
  )

  const selectAsset = useCallback((assetId: string): void => {
    setSelectedAssetId(assetId)
    setConfirmingDeleteId(null)
  }, [])

  const changeThread = useCallback((thread: TAssetThreadFilter): void => {
    setActiveThread(thread)
    setSelectedAssetId(null)
    setConfirmingDeleteId(null)
  }, [])

  const changeSearchQuery = useCallback((query: string): void => {
    setSearchQuery(query)
    setSelectedAssetId(null)
    setConfirmingDeleteId(null)
  }, [])

  return {
    activeThread,
    assets,
    assetsErrorMessage,
    busy,
    changeSearchQuery,
    changeThread,
    community,
    confirmingDeleteId,
    copyPublicReadUrl,
    deleteAsset,
    deletingAssetId,
    loadingAssets: loading && !initialData,
    openPublicReadPreview,
    references,
    selectAsset,
    selectedAsset,
    selectedAssetUrl,
    searchQuery,
    stats,
    statsErrorMessage,
    status,
    timings,
    totalCount,
    uploadFile,
    uploadProgress,
  }
}
