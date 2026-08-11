'use client'

import type { ResultOf, VariablesOf } from '@graphql-typed-document-node/core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ASSETS_HUB_ENDPOINT } from '~/config'
import useGraphQLClient from '~/hooks/useGraphQLClient'
import useQuery from '~/hooks/useQuery'
import useCommunity from '~/stores/community/hooks'
import { toast } from '~/ui/Toaster'
import S from '~/unit/DashboardThread/schema/assets'

import {
  ASSETS_HUB_DEBUG_UPLOAD_THREAD,
  ASSETS_HUB_MESSAGE,
  ASSETS_HUB_PAGE_SIZE,
  ASSETS_HUB_REFS_PAGE_SIZE,
  ASSETS_HUB_THREAD_FILTER,
  ASSETS_HUB_UPLOAD_STATUS,
} from './constant'
import {
  assetPublicReadUrl,
  assetTypeFromMime,
  checksumSha256,
  extractErrorMessage,
  putFileWithProgress,
} from './helper'
import type {
  TAsset,
  TAssetStats,
  TAssetThreadFilter,
  TAssetsHubLogic,
  TDeleteResult,
  TFinalizeResult,
  THubUploadResult,
  TPagedAssetRefs,
  TPagedAssets,
  TReferencesState,
  TTiming,
  TUploadProgress,
} from './spec'

type TCreateAssetUploadIntent = ResultOf<typeof S.createCommunityAssetUploadIntent>
type TCreateAssetUploadVariables = VariablesOf<typeof S.createCommunityAssetUploadIntent>

const EMPTY_REFS_STATE: TReferencesState = {
  assetId: null,
  entries: [],
  error: null,
  loading: false,
  totalCount: 0,
}

export default function useAssetsHub(initialData?: TPagedAssets | null): TAssetsHubLogic {
  const { slug: community } = useCommunity()
  const { mutate, query } = useGraphQLClient()
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

  const { data, error, loading, reload } = useQuery<{ pagedCommunityAssets: TPagedAssets }>(
    S.pagedCommunityAssets,
    {
      community,
      filter: assetFilter,
    },
  )
  const {
    data: statsData,
    error: statsError,
    reload: reloadStats,
  } = useQuery<{ communityAssetStats: TAssetStats }>(S.communityAssetStats, {
    community,
    filter: assetFilter,
  })

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
        const refData = await query<
          { communityAssetRefs: TPagedAssetRefs },
          { assetId: string; community: string; filter: { page: number; size: number } }
        >(
          S.communityAssetRefs,
          {
            assetId,
            community,
            filter: { page: 1, size: ASSETS_HUB_REFS_PAGE_SIZE },
          },
          { requestPolicy: 'network-only' },
        )
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
    [community, query],
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

      const runStage = async <T>(label: string, task: () => Promise<T>): Promise<T> => {
        setStatus(label)
        setTimings((items) => [...items, { label, state: 'running' }])

        const startedAt = performance.now()

        try {
          return await task()
        } finally {
          const duration = performance.now() - startedAt
          setTimings((items) =>
            items.map((item) =>
              item.label === label ? { ...item, duration, state: 'done' } : item,
            ),
          )
        }
      }

      try {
        const digest = await runStage(ASSETS_HUB_UPLOAD_STATUS.CHECKSUM, () => checksumSha256(file))
        const intent = await runStage(ASSETS_HUB_UPLOAD_STATUS.INTENT, () =>
          mutate<TCreateAssetUploadIntent, TCreateAssetUploadVariables>(
            S.createCommunityAssetUploadIntent,
            {
              community,
              file: {
                assetType: assetTypeFromMime(file.type),
                checksumSha256: digest,
                filename: file.name,
                mimeType: file.type,
                sizeBytes: file.size,
                thread: ASSETS_HUB_DEBUG_UPLOAD_THREAD,
              },
            },
          ),
        )
        const capability = intent.createCommunityAssetUploadIntent.capability
        const presignJson = await runStage(ASSETS_HUB_UPLOAD_STATUS.PRESIGN, async () => {
          const presign = await fetch(`${ASSETS_HUB_ENDPOINT}/uploads`, {
            body: JSON.stringify({ capability }),
            headers: { 'content-type': 'application/json' },
            method: 'POST',
          })
          const payload = (await presign.json()) as THubUploadResult

          if (!presign.ok) throw new Error(JSON.stringify(payload))

          return payload
        })

        await runStage(ASSETS_HUB_UPLOAD_STATUS.PUT, async () => {
          await putFileWithProgress({
            file,
            headers: presignJson.result.upload.headers,
            method: presignJson.result.upload.method,
            onProgress: setUploadProgress,
            url: presignJson.result.upload.url,
          })
        })

        const finalizeJson = await runStage(ASSETS_HUB_UPLOAD_STATUS.FINALIZE, async () => {
          const response = await fetch(
            `${ASSETS_HUB_ENDPOINT}/uploads/${intent.createCommunityAssetUploadIntent.uploadRef}/finalize`,
            {
              body: JSON.stringify({ capability }),
              headers: { 'content-type': 'application/json' },
              method: 'POST',
            },
          )
          const payload = (await response.json()) as TFinalizeResult

          if (!response.ok) throw new Error(JSON.stringify(payload))

          return payload
        })

        const finalizeTimings = finalizeJson.result?.timings ?? []

        if (finalizeTimings.length > 0) {
          setTimings((items) => [
            ...items,
            ...finalizeTimings.map((item) => ({
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
    [community, mutate, reload, reloadStats],
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
        await mutate<TDeleteResult>(S.deleteCommunityAsset, {
          community,
          id: asset.id,
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
    [community, loadReferences, mutate, reload, reloadStats, selectedAssetId],
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
