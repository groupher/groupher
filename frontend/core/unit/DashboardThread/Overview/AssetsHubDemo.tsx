'use client'

import { useRef, useState } from 'react'

import { ASSETS_HUB_ENDPOINT, ASSETS_HUB_READ_ENDPOINT } from '~/config'
import useGraphQLClient from '~/hooks/useGraphQLClient'
import useQuery from '~/hooks/useQuery'
import useCommunity from '~/stores/community/hooks'
import S from '~/unit/DashboardThread/schema'
import Button from '~/widgets/Buttons/Button'
import { toast } from '~/widgets/Toaster'

import useSalon from './salon/assets_hub_demo'

type TAsset = {
  contentHash?: string
  filename?: string
  height?: number
  id: string
  insertedAt?: string
  mimeType?: string
  publicRef?: string
  sizeBytes?: number
  storage?: string
  storageKey?: string
  url?: string
  width?: number
}

type TIntentResult = {
  createCommunityAssetUploadIntent: {
    assetPublicRef: string
    capability: string
    maxSizeBytes: number
    uploadRef: string
  }
}

type THubUploadResult = {
  result: {
    upload: {
      headers: Record<string, string>
      method: 'PUT'
      url: string
    }
  }
}

type TFinalizeResult = {
  result?: {
    timings?: Array<{
      duration: number
      label: string
    }>
  }
}

type TTiming = {
  duration?: number
  label: string
  state: 'done' | 'running'
}

type TUploadProgress = {
  loaded: number
  percent: number
  total: number
}

const checksumSha256 = async (file: File) => {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  const bytes = new Uint8Array(digest)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

const assetTypeFromMime = (mimeType: string) => (mimeType.startsWith('image/') ? 'IMAGE' : 'FILE')

const formatSize = (value?: number) => {
  if (!value) return '0 B'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

const formatDuration = (value?: number) => {
  if (value == null) return '...'
  if (value < 1000) return `${Math.round(value)} ms`
  return `${(value / 1000).toFixed(2)} s`
}

const putFileWithProgress = ({
  file,
  headers,
  method,
  onProgress,
  url,
}: {
  file: File
  headers: Record<string, string>
  method: 'PUT'
  onProgress: (progress: TUploadProgress) => void
  url: string
}) =>
  new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      onProgress({
        loaded: event.loaded,
        percent: Math.round((event.loaded / event.total) * 100),
        total: event.total,
      })
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress({ loaded: file.size, percent: 100, total: file.size })
        resolve()
      } else {
        reject(new Error(`R2 PUT failed: ${xhr.status}`))
      }
    }

    xhr.onerror = () => reject(new Error('R2 PUT failed: network error'))
    xhr.onabort = () => reject(new Error('R2 PUT aborted'))
    xhr.open(method, url)
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value)
    xhr.send(file)
  })

export default function AssetsHubDemo() {
  const s = useSalon()
  const inputRef = useRef<HTMLInputElement>(null)
  const { slug: community } = useCommunity()
  const { mutate } = useGraphQLClient()
  const [status, setStatus] = useState('idle')
  const [busy, setBusy] = useState(false)
  const [timings, setTimings] = useState<TTiming[]>([])
  const [uploadProgress, setUploadProgress] = useState<TUploadProgress | null>(null)

  const { data, error, reload } = useQuery<{
    pagedCommunityAssets: { entries: TAsset[]; totalCount: number }
  }>(S.pagedCommunityAssets, {
    community,
    filter: { page: 1, size: 6 },
  })

  const upload = async (file: File) => {
    setBusy(true)
    setStatus('checksum')
    setTimings([])
    setUploadProgress(null)

    const runStage = async <T,>(label: string, task: () => Promise<T>) => {
      setStatus(label)
      setTimings((items) => [...items, { label, state: 'running' }])

      const startedAt = performance.now()
      try {
        return await task()
      } finally {
        const duration = performance.now() - startedAt
        setTimings((items) =>
          items.map((item) => (item.label === label ? { ...item, duration, state: 'done' } : item)),
        )
      }
    }

    try {
      const digest = await runStage('checksum', () => checksumSha256(file))

      const intent = await runStage('intent', () =>
        mutate<TIntentResult>(S.createCommunityAssetUploadIntent, {
          community,
          file: {
            assetType: assetTypeFromMime(file.type),
            checksumSha256: digest,
            filename: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
          },
        }),
      )

      const capability = intent.createCommunityAssetUploadIntent.capability

      const presignJson = await runStage('presign', async () => {
        const presign = await fetch(`${ASSETS_HUB_ENDPOINT}/uploads`, {
          body: JSON.stringify({ capability }),
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        })
        const payload = (await presign.json()) as THubUploadResult
        if (!presign.ok) throw new Error(JSON.stringify(payload))
        return payload
      })

      await runStage('put', async () => {
        await putFileWithProgress({
          file,
          headers: presignJson.result.upload.headers,
          method: presignJson.result.upload.method,
          onProgress: setUploadProgress,
          url: presignJson.result.upload.url,
        })
      })

      const finalizeJson = await runStage('finalize', async () => {
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
      if (finalizeJson.result?.timings?.length) {
        setTimings((items) => [
          ...items,
          ...finalizeJson.result.timings.map((item) => ({
            duration: item.duration,
            label: `finalize.${item.label}`,
            state: 'done' as const,
          })),
        ])
      }

      setStatus('done')
      toast('Assets Hub upload completed', 'success')
      reload()
    } catch (error) {
      setStatus('failed')
      toast(error instanceof Error ? error.message : String(error), 'error')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const assets = data?.pagedCommunityAssets?.entries ?? []

  const openPublicReadPreview = (asset: TAsset) => {
    if (!asset.publicRef) {
      toast('Asset public ref is missing', 'error')
      return
    }

    window.open(
      `${ASSETS_HUB_READ_ENDPOINT}/a/${asset.publicRef}/original`,
      '_blank',
      'noopener,noreferrer',
    )
  }

  return (
    <section className={s.wrapper}>
      <div className={s.header}>
        <div>
          <h2 className={s.title}>Assets Hub v1</h2>
          <p className={s.desc}>Dashboard overview upload flow demo</p>
        </div>
        <Button loading={busy} disabled={busy} onClick={() => inputRef.current?.click()}>
          Select file
        </Button>
        <input
          ref={inputRef}
          className='hidden'
          type='file'
          accept='image/png,image/jpeg,image/webp,image/gif'
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void upload(file)
          }}
        />
      </div>

      <div className={s.state}>state: {status}</div>

      {uploadProgress && (
        <div className={s.progress}>
          <div className={s.progressBar} style={{ width: `${uploadProgress.percent}%` }} />
          <div className={s.progressMeta}>
            <span>{uploadProgress.percent}%</span>
            <span>
              {formatSize(uploadProgress.loaded)} / {formatSize(uploadProgress.total)}
            </span>
          </div>
        </div>
      )}

      {timings.length > 0 && (
        <div className={s.timings}>
          {timings.map((item) => (
            <div className={s.timingItem} key={item.label}>
              <span>{item.label}</span>
              <span className={s.timingValue}>{formatDuration(item.duration)}</span>
            </div>
          ))}
        </div>
      )}

      <div className={s.list}>
        {error && <div className={s.empty}>{error.message}</div>}
        {!error && assets.length === 0 && <div className={s.empty}>No assets yet</div>}
        {assets.map((asset) => {
          return (
            <div className={s.item} key={asset.id}>
              <div className={s.itemMain}>
                {asset.publicRef ? (
                  <button
                    type='button'
                    className={s.fileNameLink}
                    onClick={() => openPublicReadPreview(asset)}
                  >
                    {asset.filename || asset.publicRef}
                  </button>
                ) : (
                  <div className={s.fileName}>{asset.filename || asset.publicRef}</div>
                )}
                <div className={s.meta}>
                  {asset.mimeType || 'unknown'} · {formatSize(asset.sizeBytes)}
                </div>
              </div>
              <div className={s.itemSub}>{asset.publicRef}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
